import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import Parser from 'rss-parser';
import { Server } from 'socket.io';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from './db.js';
import { users, chats, chatMembers, messages, receipts } from './schema.js';
import { auth } from './auth.js';

const patchFlag = Symbol.for('verdant.feature-pack');
const routeFlag = Symbol.for('verdant.feature-routes');
const socketFlag = Symbol.for('verdant.feature-socket');
const online = new Map();
let ioRef = null;

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');
const avatarDir = path.join(uploadDir, 'avatars');
fs.mkdirSync(avatarDir, { recursive: true });

const parser = new Parser({ timeout: 10_000 });
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: avatarDir,
    filename: (request, file, callback) => {
      const original = path.extname(file.originalname || '').toLowerCase();
      const byMime = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
      callback(null, `user-${request.user.id}-${crypto.randomUUID()}${original || byMime[file.mimetype] || ''}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!String(file.mimetype || '').startsWith('image/')) return callback(new Error('Avatar must be an image'));
    return callback(null, true);
  },
});

function publicUser(user) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function peerPayload(peer) {
  if (!peer) return null;
  return {
    id: peer.id,
    username: peer.username,
    displayName: peer.displayName,
    avatarUrl: peer.avatarUrl,
    lastSeenAt: peer.lastSeenAt,
    hidePresence: peer.hidePresence,
    isOnline: online.has(Number(peer.id)),
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

async function enrichChats(list, userId) {
  const directIds = list.filter((chat) => chat.type === 'direct').map((chat) => Number(chat.id));
  let peersByChat = new Map();

  if (directIds.length) {
    const peers = await db.select({
      chatId: chatMembers.chatId,
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      lastSeenAt: users.lastSeenAt,
      hidePresence: users.hidePresence,
    })
      .from(chatMembers)
      .innerJoin(users, eq(users.id, chatMembers.userId))
      .where(and(inArray(chatMembers.chatId, directIds), ne(chatMembers.userId, Number(userId))));
    peersByChat = new Map(peers.map((peer) => [Number(peer.chatId), peer]));
  }

  return list.map((chat) => ({
    ...personalizeDirectChat(chat, peersByChat.get(Number(chat.id))),
    unreadCount: Number(chat.unreadCount || 0),
  }));
}

async function ensureMembership(chatId, userId) {
  const [membership] = await db.select().from(chatMembers).where(and(
    eq(chatMembers.chatId, Number(chatId)),
    eq(chatMembers.userId, Number(userId)),
    sql`${chatMembers.hiddenAt} IS NULL`,
  )).limit(1);
  return membership || null;
}

async function emitSharedChat(chat, targetIds) {
  if (!ioRef) return;
  for (const userId of targetIds) {
    const room = `user:${userId}`;
    ioRef.in(room).socketsJoin(`chat:${chat.id}`);
    ioRef.to(room).emit('chat:new', { ...chat, unreadCount: 0 });
  }
}

function registerRoutes(app, originalGet, originalPost) {
  if (app[routeFlag]) return;
  app[routeFlag] = true;

  originalGet.call(app, '/api/v2/chats', auth, async (request, response) => {
    const userId = Number(request.user.id);
    const unreadCount = sql`(
      SELECT COUNT(*)
      FROM messages AS unread_messages
      LEFT JOIN receipts AS unread_receipts
        ON unread_receipts.message_id = unread_messages.id
        AND unread_receipts.user_id = ${userId}
      WHERE unread_messages.chat_id = ${chats.id}
        AND unread_messages.sender_id <> ${userId}
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
      unreadCount,
    }).from(chats)
      .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
      .where(and(eq(chatMembers.userId, userId), sql`${chatMembers.hiddenAt} IS NULL`))
      .orderBy(desc(chats.updatedAt));

    response.json({ chats: await enrichChats(list, userId) });
  });

  originalGet.call(app, '/api/v2/chats/:id/messages', auth, async (request, response) => {
    const chatId = Number(request.params.id);
    if (!await ensureMembership(chatId, request.user.id)) return response.status(403).json({ error: 'Not a member' });
    const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
    if (!chat) return response.status(404).json({ error: 'Chat not found' });

    if (chat.type === 'rss') {
      try {
        const feed = await parser.parseURL(chat.rssUrl);
        return response.json({
          rss: true,
          feed: { title: feed.title, link: feed.link, description: feed.description },
          items: (feed.items || []).slice(0, 100).map((item, index) => ({
            id: item.guid || item.id || `rss-${index}`,
            type: 'rss',
            title: item.title,
            body: item.contentSnippet || item.content || item.description || '',
            link: item.link,
            author: item.creator || item.author || '',
            imageUrl: item.enclosure?.url || null,
            imageType: item.enclosure?.type || null,
            createdAt: item.isoDate || item.pubDate || new Date().toISOString(),
          })),
        });
      } catch (error) {
        return response.status(502).json({ error: error.message || 'RSS refresh failed' });
      }
    }

    const rows = await db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.createdAt);
    return response.json({
      messages: rows.map((item) => ({
        ...item,
        fileUrl: item.filePath ? `/uploads/${path.relative(uploadDir, item.filePath).replaceAll(path.sep, '/')}` : null,
        fileExpired: Boolean(item.fileExpiredAt),
      })),
    });
  });

  originalGet.call(app, '/api/v2/presence', auth, (_request, response) => {
    response.json({ onlineUserIds: [...online.keys()] });
  });

  originalGet.call(app, '/api/v2/admin/online-users', auth, async (request, response) => {
    if (request.user.role !== 'admin') return response.status(403).json({ error: 'Admin only' });
    const ids = [...online.keys()];
    if (!ids.length) return response.json({ users: [], total: 0 });
    const list = await db.select().from(users).where(inArray(users.id, ids));
    return response.json({
      total: list.length,
      users: list.map((user) => ({
        ...publicUser(user),
        isOnline: true,
        connections: online.get(Number(user.id)) || 0,
      })),
    });
  });

  originalPost.call(app, '/api/v2/me/avatar', auth, (request, response) => {
    avatarUpload.single('avatar')(request, response, async (error) => {
      if (error) return response.status(400).json({ error: error.message });
      if (!request.file) return response.status(400).json({ error: 'Choose an image first' });
      const avatarUrl = `/uploads/avatars/${path.basename(request.file.path)}`;
      const [user] = await db.update(users).set({ avatarUrl }).where(eq(users.id, request.user.id)).returning();
      return response.json({ user: publicUser(user), avatarUrl });
    });
  });

  originalPost.call(app, '/api/v2/chats/:id/share', auth, async (request, response) => {
    const chatId = Number(request.params.id);
    const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
    if (!chat || chat.type !== 'rss') return response.status(404).json({ error: 'RSS channel not found' });
    if (chat.ownerId !== request.user.id && request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Only the owner or an administrator can share this RSS channel' });
    }

    let targetIds;
    if (request.body.all) {
      targetIds = (await db.select({ id: users.id }).from(users).where(eq(users.isBanned, false))).map((item) => Number(item.id));
    } else {
      targetIds = [...new Set((request.body.userIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    }
    if (!targetIds.length) return response.status(400).json({ error: 'Select at least one user' });

    const now = new Date();
    for (const userId of targetIds) {
      await db.insert(chatMembers).values({ chatId, userId, joinedAt: now }).onConflictDoUpdate({
        target: [chatMembers.chatId, chatMembers.userId],
        set: { hiddenAt: null },
      });
    }
    await emitSharedChat(chat, targetIds);
    return response.json({ ok: true, sharedCount: targetIds.length });
  });
}

if (!express.application[patchFlag]) {
  express.application[patchFlag] = true;
  const originalGet = express.application.get;
  const originalPost = express.application.post;

  express.application.get = function patchedGet(pathValue, ...handlers) {
    registerRoutes(this, originalGet, originalPost);
    return originalGet.call(this, pathValue, ...handlers);
  };

  express.application.post = function patchedPost(pathValue, ...handlers) {
    registerRoutes(this, originalGet, originalPost);
    return originalPost.call(this, pathValue, ...handlers);
  };
}

if (!Server.prototype[socketFlag]) {
  Server.prototype[socketFlag] = true;
  const originalOn = Server.prototype.on;

  Server.prototype.on = function patchedOn(event, listener) {
    if (event === 'connection' && !this[patchFlag]) {
      this[patchFlag] = true;
      ioRef = this;
      originalOn.call(this, 'connection', (socket) => {
        const userId = Number(socket.authPayload?.sub);
        if (!Number.isInteger(userId)) return;
        online.set(userId, (online.get(userId) || 0) + 1);
        socket.emit('presence:snapshot', { onlineUserIds: [...online.keys()] });
        socket.on('disconnect', () => {
          const next = Math.max(0, (online.get(userId) || 1) - 1);
          if (next) online.set(userId, next);
          else online.delete(userId);
        });
      });
    }
    return originalOn.call(this, event, listener);
  };
}
