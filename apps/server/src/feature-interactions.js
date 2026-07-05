import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { auth } from './auth.js';
import { sqlite } from './db.js';
import { ensureMembership, route } from './feature-state.js';
import { getFeatureIo } from './feature-io.js';

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');
const ALLOWED_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥']);

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return Math.min(number, maximum);
}

function fileUrl(filePath) {
  if (!filePath) return null;
  return `/uploads/${path.relative(uploadDir, filePath).replaceAll(path.sep, '/')}`;
}

function publicMessage(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    sender: {
      id: row.sender_id,
      username: row.sender_username,
      displayName: row.sender_display_name,
      avatarUrl: row.sender_avatar_url,
    },
    type: row.deleted_at ? 'deleted' : row.type,
    body: row.deleted_at ? null : row.body,
    fileName: row.deleted_at ? null : row.file_name,
    fileUrl: row.deleted_at ? null : fileUrl(row.file_path),
    mimeType: row.deleted_at ? null : row.mime_type,
    fileSize: row.deleted_at ? null : row.file_size,
    fileExpired: Boolean(row.file_expired_at),
    replyToId: row.reply_to_id,
    replyTo: row.reply_to_id ? {
      id: row.reply_to_id,
      senderId: row.reply_sender_id,
      senderName: row.reply_sender_name || row.reply_sender_username || 'User',
      body: row.reply_deleted_at ? 'Message deleted' : (row.reply_body || row.reply_file_name || 'Attachment'),
      deletedAt: row.reply_deleted_at,
    } : null,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    reactions: [],
  };
}

function baseMessageQuery(extraWhere = '') {
  return `
    SELECT
      m.*,
      sender.username AS sender_username,
      sender.display_name AS sender_display_name,
      sender.avatar_url AS sender_avatar_url,
      reply.sender_id AS reply_sender_id,
      reply.body AS reply_body,
      reply.file_name AS reply_file_name,
      reply.deleted_at AS reply_deleted_at,
      reply_sender.username AS reply_sender_username,
      reply_sender.display_name AS reply_sender_name
    FROM messages m
    INNER JOIN users sender ON sender.id = m.sender_id
    LEFT JOIN messages reply ON reply.id = m.reply_to_id
    LEFT JOIN users reply_sender ON reply_sender.id = reply.sender_id
    ${extraWhere}
  `;
}

function attachReactions(messageRows, currentUserId) {
  const messages = messageRows.map(publicMessage);
  const ids = messages.map((message) => message.id);
  if (!ids.length) return messages;

  const placeholders = ids.map(() => '?').join(',');
  const reactions = sqlite.prepare(`
    SELECT emoji, user_id, message_id
    FROM message_reactions
    WHERE message_id IN (${placeholders})
    ORDER BY id ASC
  `).all(...ids);

  const map = new Map();
  for (const reaction of reactions) {
    const messageMap = map.get(reaction.message_id) || new Map();
    const entry = messageMap.get(reaction.emoji) || {
      emoji: reaction.emoji,
      count: 0,
      reacted: false,
      userIds: [],
    };
    entry.count += 1;
    entry.userIds.push(reaction.user_id);
    if (Number(reaction.user_id) === Number(currentUserId)) entry.reacted = true;
    messageMap.set(reaction.emoji, entry);
    map.set(reaction.message_id, messageMap);
  }

  return messages.map((message) => ({
    ...message,
    reactions: [...(map.get(message.id)?.values() || [])],
  }));
}

function getMessage(messageId, currentUserId) {
  const row = sqlite.prepare(`${baseMessageQuery('WHERE m.id = ?')} LIMIT 1`).get(messageId);
  if (!row) return null;
  return attachReactions([row], currentUserId)[0];
}

function emitToChat(chatId, event, payload) {
  getFeatureIo()?.to(`chat:${chatId}`).emit(event, payload);
}

export function createInteractionRouter() {
  const router = express.Router();

  router.get('/chats/:id/messages/page', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    if (!await ensureMembership(chatId, request.user.id)) {
      return response.status(403).json({ error: 'Not a member' });
    }

    const limit = positiveInteger(request.query.limit, 40, 80);
    const before = positiveInteger(request.query.before, null);
    const where = before
      ? 'WHERE m.chat_id = ? AND m.id < ?'
      : 'WHERE m.chat_id = ?';
    const args = before ? [chatId, before, limit + 1] : [chatId, limit + 1];
    const rows = sqlite.prepare(`${baseMessageQuery(where)} ORDER BY m.id DESC LIMIT ?`).all(...args);
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit).reverse();
    const items = attachReactions(selected, request.user.id);

    return response.json({
      messages: items,
      hasMore,
      nextCursor: hasMore && selected.length ? selected[0].id : null,
    });
  }));

  router.post('/chats/:id/messages', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    if (!await ensureMembership(chatId, request.user.id)) {
      return response.status(403).json({ error: 'Not a member' });
    }

    const body = String(request.body.body || '').trim().slice(0, 10_000);
    if (!body) return response.status(400).json({ error: 'Message cannot be empty' });

    let replyToId = request.body.replyToId ? Number(request.body.replyToId) : null;
    if (replyToId) {
      const reply = sqlite.prepare('SELECT id FROM messages WHERE id = ? AND chat_id = ?').get(replyToId, chatId);
      if (!reply) return response.status(400).json({ error: 'Reply target is not in this chat' });
    }

    const now = Date.now();
    const result = sqlite.prepare(`
      INSERT INTO messages (client_id, chat_id, sender_id, type, body, reply_to_id, created_at)
      VALUES (?, ?, ?, 'text', ?, ?, ?)
    `).run(request.body.clientId || crypto.randomUUID(), chatId, request.user.id, body, replyToId, now);
    sqlite.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(now, chatId);

    const message = getMessage(Number(result.lastInsertRowid), request.user.id);
    emitToChat(chatId, 'message:new', message);
    return response.status(201).json({ message });
  }));

  router.patch('/messages/:id', auth, route(async (request, response) => {
    const messageId = Number(request.params.id);
    const row = sqlite.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!row) return response.status(404).json({ error: 'Message not found' });
    if (!await ensureMembership(row.chat_id, request.user.id)) {
      return response.status(403).json({ error: 'Not a member' });
    }
    if (row.sender_id !== request.user.id) return response.status(403).json({ error: 'You can only edit your own messages' });
    if (row.deleted_at) return response.status(409).json({ error: 'Deleted messages cannot be edited' });
    if (row.type !== 'text') return response.status(400).json({ error: 'Only text messages can be edited' });

    const body = String(request.body.body || '').trim().slice(0, 10_000);
    if (!body) return response.status(400).json({ error: 'Message cannot be empty' });
    const editedAt = Date.now();
    sqlite.prepare('UPDATE messages SET body = ?, edited_at = ? WHERE id = ?').run(body, editedAt, messageId);

    const message = getMessage(messageId, request.user.id);
    emitToChat(row.chat_id, 'message:updated', message);
    return response.json({ message });
  }));

  router.delete('/messages/:id', auth, route(async (request, response) => {
    const messageId = Number(request.params.id);
    const row = sqlite.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!row) return response.status(404).json({ error: 'Message not found' });
    if (!await ensureMembership(row.chat_id, request.user.id)) {
      return response.status(403).json({ error: 'Not a member' });
    }
    if (row.sender_id !== request.user.id && request.user.role !== 'admin') {
      return response.status(403).json({ error: 'You can only delete your own messages' });
    }

    if (row.file_path) {
      fs.promises.unlink(row.file_path).catch(() => {});
    }

    const deletedAt = Date.now();
    sqlite.prepare(`
      UPDATE messages
      SET type = 'deleted', body = NULL, file_name = NULL, file_path = NULL,
          mime_type = NULL, file_size = NULL, file_expired_at = NULL, deleted_at = ?
      WHERE id = ?
    `).run(deletedAt, messageId);
    sqlite.prepare('DELETE FROM message_reactions WHERE message_id = ?').run(messageId);

    emitToChat(row.chat_id, 'message:deleted', { id: messageId, chatId: row.chat_id, deletedAt });
    return response.json({ ok: true, id: messageId, deletedAt });
  }));

  router.post('/messages/:id/reactions', auth, route(async (request, response) => {
    const messageId = Number(request.params.id);
    const emoji = String(request.body.emoji || '');
    if (!ALLOWED_REACTIONS.has(emoji)) return response.status(400).json({ error: 'Unsupported reaction' });

    const row = sqlite.prepare('SELECT id, chat_id, deleted_at FROM messages WHERE id = ?').get(messageId);
    if (!row) return response.status(404).json({ error: 'Message not found' });
    if (row.deleted_at) return response.status(409).json({ error: 'Deleted messages cannot receive reactions' });
    if (!await ensureMembership(row.chat_id, request.user.id)) {
      return response.status(403).json({ error: 'Not a member' });
    }

    const existing = sqlite.prepare(`
      SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?
    `).get(messageId, request.user.id, emoji);

    if (existing) {
      sqlite.prepare('DELETE FROM message_reactions WHERE id = ?').run(existing.id);
    } else {
      sqlite.prepare(`
        INSERT INTO message_reactions (message_id, user_id, emoji, created_at)
        VALUES (?, ?, ?, ?)
      `).run(messageId, request.user.id, emoji, Date.now());
    }

    const message = getMessage(messageId, request.user.id);
    emitToChat(row.chat_id, 'message:reactions', {
      messageId,
      chatId: row.chat_id,
      reactions: message.reactions,
    });
    return response.json({ reactions: message.reactions });
  }));

  router.patch('/chats/:id/preferences', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    if (!await ensureMembership(chatId, request.user.id)) {
      return response.status(403).json({ error: 'Not a member' });
    }

    const current = sqlite.prepare(`
      SELECT pinned_at, archived_at, muted_until
      FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(chatId, request.user.id);
    const now = Date.now();
    const pinnedAt = request.body.pinned === undefined ? current.pinned_at : (request.body.pinned ? now : null);
    const archivedAt = request.body.archived === undefined ? current.archived_at : (request.body.archived ? now : null);
    const mutedUntil = request.body.muted === undefined ? current.muted_until : (request.body.muted ? 253402300799000 : null);

    sqlite.prepare(`
      UPDATE chat_members
      SET pinned_at = ?, archived_at = ?, muted_until = ?
      WHERE chat_id = ? AND user_id = ?
    `).run(pinnedAt, archivedAt, mutedUntil, chatId, request.user.id);

    return response.json({
      preferences: {
        pinned: Boolean(pinnedAt),
        pinnedAt,
        archived: Boolean(archivedAt),
        archivedAt,
        muted: Boolean(mutedUntil && mutedUntil > now),
        mutedUntil,
      },
    });
  }));

  router.get('/chats/:id/media', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    if (!await ensureMembership(chatId, request.user.id)) {
      return response.status(403).json({ error: 'Not a member' });
    }

    const limit = positiveInteger(request.query.limit, 30, 60);
    const before = positiveInteger(request.query.before, null);
    const beforeClause = before ? 'AND m.id < ?' : '';
    const args = before ? [chatId, before, limit + 1] : [chatId, limit + 1];
    const rows = sqlite.prepare(`
      ${baseMessageQuery(`
        WHERE m.chat_id = ?
          ${beforeClause}
          AND m.deleted_at IS NULL
          AND m.file_path IS NOT NULL
          AND (m.mime_type LIKE 'image/%' OR m.mime_type LIKE 'video/%')
      `)}
      ORDER BY m.id DESC
      LIMIT ?
    `).all(...args);
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit);

    return response.json({
      items: attachReactions(selected, request.user.id),
      hasMore,
      nextCursor: hasMore && selected.length ? selected[selected.length - 1].id : null,
    });
  }));

  return router;
}
