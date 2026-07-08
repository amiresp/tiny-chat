import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { auth } from './auth.js';
import { sqlite } from './db.js';
import { ensureMembership, route } from './feature-state.js';
import { getFeatureIo } from './feature-io.js';

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');

function integer(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function hasColumn(tableName, columnName) {
  return sqlite.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
}

function addColumn(tableName, columnName, definition) {
  if (!hasColumn(tableName, columnName)) sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

// Keep this router self-sufficient. Do not rely on feature-pack import order.
addColumn('messages', 'delivered_at', 'INTEGER');
addColumn('messages', 'failed_at', 'INTEGER');
addColumn('messages', 'forwarded_from_id', 'INTEGER');

function messageQuery(where) {
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
    ${where}
  `;
}

function mapMessage(row) {
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
    fileUrl: row.deleted_at || !row.file_path
      ? null
      : `/uploads/${path.relative(uploadDir, row.file_path).replaceAll(path.sep, '/')}`,
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
    forwardedFromId: row.forwarded_from_id,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    deliveredAt: row.delivered_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
    reactions: [],
  };
}

function hydrate(rows, userId) {
  const messages = rows.map(mapMessage);
  const ids = messages.map((message) => message.id);
  if (!ids.length) return messages;

  const reactions = sqlite.prepare(`
    SELECT message_id, user_id, emoji
    FROM message_reactions
    WHERE message_id IN (${ids.map(() => '?').join(',')})
    ORDER BY id ASC
  `).all(...ids);
  const grouped = new Map();

  for (const reaction of reactions) {
    const messageReactions = grouped.get(reaction.message_id) || new Map();
    const item = messageReactions.get(reaction.emoji) || {
      emoji: reaction.emoji,
      count: 0,
      reacted: false,
      userIds: [],
    };
    item.count += 1;
    item.userIds.push(reaction.user_id);
    if (Number(reaction.user_id) === Number(userId)) item.reacted = true;
    messageReactions.set(reaction.emoji, item);
    grouped.set(reaction.message_id, messageReactions);
  }

  return messages.map((message) => ({
    ...message,
    reactions: [...(grouped.get(message.id)?.values() || [])],
  }));
}

function getMessage(id, userId) {
  const row = sqlite.prepare(`${messageQuery('WHERE m.id = ?')} LIMIT 1`).get(id);
  return row ? hydrate([row], userId)[0] : null;
}

function markRead(messages, userId) {
  const now = Date.now();
  const statement = sqlite.prepare(`
    INSERT INTO receipts (message_id, user_id, delivered_at, read_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(message_id,user_id)
    DO UPDATE SET delivered_at = excluded.delivered_at, read_at = excluded.read_at
  `);
  const transaction = sqlite.transaction((items) => {
    for (const message of items) {
      if (Number(message.senderId) !== Number(userId)) {
        statement.run(message.id, userId, now, now);
      }
    }
  });
  transaction(messages);
}

function canSendToChat(chatId, senderId) {
  const chat = sqlite.prepare('SELECT id,type FROM chats WHERE id=?').get(chatId);
  if (!chat) return { ok: false, status: 404, error: 'Chat not found.' };
  if (chat.type !== 'direct') return { ok: true };

  const peer = sqlite.prepare('SELECT user_id FROM chat_members WHERE chat_id=? AND user_id<>? LIMIT 1').get(chatId, senderId);
  if (!peer) return { ok: true };

  const blocked = sqlite.prepare(`
    SELECT 1 FROM user_blocks
    WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)
    LIMIT 1
  `).get(senderId, peer.user_id, peer.user_id, senderId);
  if (blocked) return { ok: false, status: 403, error: 'Messaging is blocked for this conversation.' };

  const peerPrivacy = sqlite.prepare('SELECT allow_messages FROM user_privacy WHERE user_id=?').get(peer.user_id);
  if (peerPrivacy?.allow_messages === 'contacts') {
    return { ok: false, status: 403, error: 'This user only accepts messages from contacts.' };
  }

  return { ok: true };
}

export function createMessagePageRouter() {
  const router = express.Router();

  router.get('/chats/:id/messages/page', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    if (!await ensureMembership(chatId, request.user.id)) {
      return response.status(403).json({ error: 'Not a member' });
    }

    const limit = integer(request.query.limit, 40, 80);
    const before = integer(request.query.before, null);
    const where = before
      ? 'WHERE m.chat_id = ? AND m.id < ?'
      : 'WHERE m.chat_id = ?';
    const params = before ? [chatId, before, limit + 1] : [chatId, limit + 1];
    const rows = sqlite.prepare(`${messageQuery(where)} ORDER BY m.id DESC LIMIT ?`).all(...params);
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit).reverse();
    const messages = hydrate(selected, request.user.id);

    if (!before) markRead(messages, request.user.id);

    return response.json({
      messages,
      hasMore,
      nextCursor: hasMore && selected.length ? selected[0].id : null,
    });
  }));

  router.post('/chats/:id/messages', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    if (!await ensureMembership(chatId, request.user.id)) {
      return response.status(403).json({ error: 'Not a member' });
    }

    const allowed = canSendToChat(chatId, request.user.id);
    if (!allowed.ok) return response.status(allowed.status).json({ error: allowed.error });

    const body = String(request.body.body || '').trim().slice(0, 10_000);
    if (!body) return response.status(400).json({ error: 'Message cannot be empty' });

    const clientId = String(request.body.clientId || crypto.randomUUID());
    const existing = sqlite.prepare('SELECT id, chat_id, sender_id FROM messages WHERE client_id = ?').get(clientId);
    if (existing) {
      if (Number(existing.sender_id) !== Number(request.user.id) || Number(existing.chat_id) !== chatId) {
        return response.status(409).json({ error: 'Client message ID is already in use' });
      }
      return response.json({ message: getMessage(existing.id, request.user.id), duplicate: true });
    }

    const replyToId = request.body.replyToId ? Number(request.body.replyToId) : null;
    if (replyToId && !sqlite.prepare('SELECT id FROM messages WHERE id = ? AND chat_id = ?').get(replyToId, chatId)) {
      return response.status(400).json({ error: 'Reply target is not in this chat' });
    }

    const now = Date.now();
    const result = sqlite.prepare(`
      INSERT INTO messages (client_id, chat_id, sender_id, type, body, reply_to_id, delivered_at, created_at)
      VALUES (?, ?, ?, 'text', ?, ?, ?, ?)
    `).run(clientId, chatId, request.user.id, body, replyToId, now, now);
    sqlite.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(now, chatId);

    const message = getMessage(Number(result.lastInsertRowid), request.user.id);
    getFeatureIo()?.to(`chat:${chatId}`).emit('message:new', message);
    return response.status(201).json({ message });
  }));

  return router;
}
