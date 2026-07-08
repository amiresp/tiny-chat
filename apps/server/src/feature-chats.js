import express from 'express';
import path from 'node:path';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from './db.js';
import { users, chats, chatMembers, messages, receipts } from './schema.js';
import { auth } from './auth.js';
import {
  ensureMembership,
  getOnlineEntry,
  route,
} from './feature-state.js';

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');

function peerPayload(peer) {
  if (!peer) return null;
  const entry = getOnlineEntry(peer.id);
  return {
    id: peer.id,
    username: peer.username,
    displayName: peer.displayName,
    avatarUrl: peer.avatarUrl,
    hidePresence: peer.hidePresence,
    lastSeenAt: peer.hidePresence ? null : peer.lastSeenAt,
    isOnline: Boolean(entry && !entry.hidden),
  };
}

function personalizeDirectChat(chat, peer) {
  if (!chat || chat.type !== 'direct' || !peer) return chat;
  return {
    ...chat,
    title: peer.displayName || peer.username,
    avatarUrl: peer.avatarUrl || null,
    peer: peerPayload(peer),
  };
}

async function ensureSavedMessagesChat(userId) {
  const [existing] = await db.select({ id: chats.id })
    .from(chats)
    .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    .where(and(
      eq(chats.type, 'saved'),
      eq(chats.ownerId, userId),
      eq(chatMembers.userId, userId),
    ))
    .limit(1);

  if (existing) return existing.id;

  const now = new Date();
  const [chat] = await db.insert(chats).values({
    type: 'saved',
    title: 'Saved Messages',
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
  }).returning();

  await db.insert(chatMembers).values({
    chatId: chat.id,
    userId,
    joinedAt: now,
    pinnedAt: now,
  }).onConflictDoNothing();

  return chat.id;
}

async function enrichChats(list, currentUserId) {
  const directIds = list.filter((chat) => chat.type === 'direct').map((chat) => Number(chat.id));
  let peerByChatId = new Map();

  if (directIds.length) {
    const peers = await db.select({
      chatId: chatMembers.chatId,
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      hidePresence: users.hidePresence,
      lastSeenAt: users.lastSeenAt,
    })
      .from(chatMembers)
      .innerJoin(users, eq(users.id, chatMembers.userId))
      .where(and(
        inArray(chatMembers.chatId, directIds),
        ne(chatMembers.userId, Number(currentUserId)),
      ));
    peerByChatId = new Map(peers.map((peer) => [Number(peer.chatId), peer]));
  }

  const now = Date.now();
  return list.map((chat) => ({
    ...personalizeDirectChat(chat, peerByChatId.get(Number(chat.id))),
    title: chat.type === 'saved' ? 'Saved Messages' : (chat.title || `${chat.type} chat`),
    unreadCount: Number(chat.unreadCount || 0),
    pinned: chat.type === 'saved' ? true : Boolean(chat.pinnedAt),
    archived: Boolean(chat.archivedAt),
    muted: Boolean(chat.mutedUntil && new Date(chat.mutedUntil).getTime() > now),
  }));
}

function notifyUser(io, userId, chat) {
  if (!io) return;
  const room = `user:${userId}`;
  io.in(room).socketsJoin(`chat:${chat.id}`);
  io.to(room).emit('chat:new', {
    ...chat,
    unreadCount: 0,
    pinned: false,
    archived: false,
    muted: false,
  });
}

export function createChatFeatureRouter({ io = null } = {}) {
  const router = express.Router();

  router.get('/chats', auth, route(async (request, response) => {
    const userId = Number(request.user.id);
    await ensureSavedMessagesChat(userId);

    const unreadCount = sql`(
      SELECT COUNT(*)
      FROM messages AS unread_messages
      LEFT JOIN receipts AS unread_receipts
        ON unread_receipts.message_id = unread_messages.id
        AND unread_receipts.user_id = ${userId}
      WHERE unread_messages.chat_id = ${chats.id}
        AND unread_messages.sender_id <> ${userId}
        AND unread_messages.deleted_at IS NULL
        AND unread_receipts.read_at IS NULL
    )`.as('unread_count');

    const list = await db.select({
      id: chats.id,
      type: chats.type,
      title: chats.title,
      avatarUrl: chats.avatarUrl,
      ownerId: chats.ownerId,
      rssUrl: chats.rssUrl,
      updatedAt: chats.updatedAt,
      pinnedAt: chatMembers.pinnedAt,
      archivedAt: chatMembers.archivedAt,
      mutedUntil: chatMembers.mutedUntil,
      unreadCount,
    }).from(chats)
      .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
      .where(and(
        eq(chatMembers.userId, userId),
        sql`${chatMembers.hiddenAt} IS NULL`,
      ))
      .orderBy(desc(chatMembers.pinnedAt), desc(chats.updatedAt));

    response.json({ chats: await enrichChats(list, userId) });
  }));

  router.get('/chats/:id/messages', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    if (!await ensureMembership(chatId, request.user.id)) {
      return response.status(403).json({ error: 'Not a member' });
    }

    const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
    if (!chat) return response.status(404).json({ error: 'Chat not found' });
    if (chat.type === 'rss') return response.json({ rss: true, url: chat.rssUrl });

    const rows = await db.select().from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);

    return response.json({
      messages: rows.map((item) => ({
        ...item,
        fileUrl: item.filePath
          ? `/uploads/${path.relative(uploadDir, item.filePath).replaceAll(path.sep, '/')}`
          : null,
        fileExpired: Boolean(item.fileExpiredAt),
      })),
    });
  }));

  router.post('/rss', auth, route(async (request, response) => {
    let feedUrl;
    try {
      feedUrl = new URL(String(request.body.url || '').trim());
    } catch {
      return response.status(400).json({ error: 'Enter a valid RSS or Atom URL' });
    }
    if (!['http:', 'https:'].includes(feedUrl.protocol)) {
      return response.status(400).json({ error: 'RSS URL must use http or https' });
    }

    const now = new Date();
    const fallbackTitle = feedUrl.hostname.replace(/^www\./, '');
    const [chat] = await db.insert(chats).values({
      type: 'rss',
      title: String(request.body.title || fallbackTitle).trim() || fallbackTitle,
      rssUrl: feedUrl.toString(),
      ownerId: request.user.id,
      createdAt: now,
      updatedAt: now,
    }).returning();

    await db.insert(chatMembers).values({
      chatId: chat.id,
      userId: request.user.id,
      joinedAt: now,
    });

    notifyUser(io, request.user.id, chat);
    return response.status(201).json({ chat: { ...chat, unreadCount: 0, pinned: false, archived: false, muted: false } });
  }));

  router.post('/chats/:id/share', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
    if (!chat || chat.type !== 'rss') return response.status(404).json({ error: 'RSS channel not found' });
    if (chat.ownerId !== request.user.id && request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Only the owner or an administrator can share this RSS channel' });
    }

    let targetIds;
    if (request.body.all) {
      targetIds = (await db.select({ id: users.id }).from(users).where(eq(users.isBanned, false)))
        .map((item) => Number(item.id));
    } else {
      targetIds = [...new Set(
        (request.body.userIds || [])
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0),
      )];
    }
    if (!targetIds.length) return response.status(400).json({ error: 'Select at least one user' });

    const now = new Date();
    for (const userId of targetIds) {
      await db.insert(chatMembers).values({
        chatId,
        userId,
        joinedAt: now,
      }).onConflictDoUpdate({
        target: [chatMembers.chatId, chatMembers.userId],
        set: { hiddenAt: null },
      });
      notifyUser(io, userId, chat);
    }

    return response.json({ ok: true, sharedCount: targetIds.length });
  }));

  return router;
}
