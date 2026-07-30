import path from 'node:path';
import express from 'express';
import { sqlite } from './db.js';
import { auth } from './auth.js';
import { route } from './feature-state.js';

function requireAdmin(user) {
  const role = String(user?.role || '').toLowerCase();
  if (!['admin', 'administrator', 'superadmin', 'owner'].includes(role)) {
    const error = new Error('Admin access is required.');
    error.status = 403;
    throw error;
  }
}

function normalizeLimit(value, fallback = 200, maximum = 500) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function loadParticipants(chatIds = null) {
  if (Array.isArray(chatIds) && chatIds.length === 0) return new Map();

  const parameters = [];
  let where = '';
  if (Array.isArray(chatIds)) {
    where = `WHERE cm.chat_id IN (${chatIds.map(() => '?').join(',')})`;
    parameters.push(...chatIds);
  }

  const rows = sqlite.prepare(`
    SELECT
      cm.chat_id AS chatId,
      cm.joined_at AS joinedAt,
      u.id AS id,
      u.username AS username,
      u.mobile AS mobile,
      u.display_name AS displayName,
      u.avatar_url AS avatarUrl,
      u.role AS role,
      u.is_banned AS isBanned
    FROM chat_members cm
    INNER JOIN users u ON u.id = cm.user_id
    ${where}
    ORDER BY cm.chat_id ASC, cm.joined_at ASC, u.id ASC
  `).all(...parameters);

  const grouped = new Map();
  for (const row of rows) {
    const participant = {
      id: Number(row.id),
      username: row.username,
      mobile: row.mobile,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      role: row.role,
      isBanned: Boolean(row.isBanned),
      joinedAt: row.joinedAt,
    };
    if (!grouped.has(row.chatId)) grouped.set(row.chatId, []);
    grouped.get(row.chatId).push(participant);
  }
  return grouped;
}

function chatLabel(chat, participants) {
  const names = participants.map((user) => user.displayName || user.username || `User #${user.id}`);
  if (chat.type === 'direct') return names.join(' ↔ ') || `Direct chat #${chat.id}`;
  if (chat.type === 'saved') return `Saved Messages · ${names[0] || `User #${chat.ownerId || '—'}`}`;
  return chat.title || names.join(', ') || `${chat.type} chat #${chat.id}`;
}

function adminChatRows() {
  const rows = sqlite.prepare(`
    SELECT
      c.id AS id,
      c.type AS type,
      c.title AS title,
      c.avatar_url AS avatarUrl,
      c.owner_id AS ownerId,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,
      COUNT(m.id) AS messageCount,
      MAX(m.created_at) AS lastMessageAt,
      (
        SELECT COALESCE(
          NULLIF(last_message.body, ''),
          last_message.file_name,
          CASE
            WHEN last_message.type = 'voice' THEN 'Voice message'
            WHEN last_message.type = 'image' THEN 'Image'
            WHEN last_message.type = 'video' THEN 'Video'
            WHEN last_message.type = 'file' THEN 'File'
            ELSE last_message.type
          END
        )
        FROM messages last_message
        WHERE last_message.chat_id = c.id
        ORDER BY last_message.id DESC
        LIMIT 1
      ) AS lastMessagePreview
    FROM chats c
    LEFT JOIN messages m ON m.chat_id = c.id
    GROUP BY c.id
    ORDER BY COALESCE(MAX(m.created_at), c.updated_at) DESC, c.id DESC
  `).all();

  const participantsByChat = loadParticipants(rows.map((row) => row.id));
  return rows.map((row) => {
    const participants = participantsByChat.get(row.id) || [];
    const chat = {
      ...row,
      id: Number(row.id),
      ownerId: row.ownerId == null ? null : Number(row.ownerId),
      messageCount: Number(row.messageCount || 0),
      participants,
    };
    return { ...chat, displayTitle: chatLabel(chat, participants) };
  });
}

export function createAdminChatAuditRouter() {
  const router = express.Router();

  router.get('/admin/audit/chats', auth, route(async (request, response) => {
    requireAdmin(request.user);
    return response.json({ chats: adminChatRows() });
  }));

  router.get('/admin/audit/chats/:id/messages', auth, route(async (request, response) => {
    requireAdmin(request.user);

    const chatId = Number(request.params.id);
    if (!Number.isInteger(chatId) || chatId <= 0) {
      return response.status(400).json({ error: 'Invalid chat.' });
    }

    const chatRow = sqlite.prepare(`
      SELECT
        id,
        type,
        title,
        avatar_url AS avatarUrl,
        owner_id AS ownerId,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM chats
      WHERE id = ?
    `).get(chatId);
    if (!chatRow) return response.status(404).json({ error: 'Chat not found.' });

    const participants = loadParticipants([chatId]).get(chatId) || [];
    const limit = normalizeLimit(request.query.limit);
    const before = Number(request.query.before || 0);
    const beforeFilter = Number.isInteger(before) && before > 0 ? 'AND m.id < ?' : '';
    const parameters = [chatId];
    if (beforeFilter) parameters.push(before);
    parameters.push(limit + 1);

    const rows = sqlite.prepare(`
      SELECT
        m.id AS id,
        m.client_id AS clientId,
        m.chat_id AS chatId,
        m.sender_id AS senderId,
        m.type AS type,
        m.body AS body,
        m.file_name AS fileName,
        m.file_path AS filePath,
        m.mime_type AS mimeType,
        m.file_size AS fileSize,
        m.file_expired_at AS fileExpiredAt,
        m.reply_to_id AS replyToId,
        m.edited_at AS editedAt,
        m.deleted_at AS deletedAt,
        m.created_at AS createdAt,
        u.username AS senderUsername,
        u.display_name AS senderDisplayName,
        u.mobile AS senderMobile,
        u.avatar_url AS senderAvatarUrl
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.chat_id = ?
      ${beforeFilter}
      ORDER BY m.id DESC
      LIMIT ?
    `).all(...parameters);

    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit).reverse().map((message) => ({
      ...message,
      id: Number(message.id),
      chatId: Number(message.chatId),
      senderId: Number(message.senderId),
      fileUrl: message.filePath ? `/uploads/${path.basename(message.filePath)}` : null,
      fileExpired: Boolean(message.fileExpiredAt),
      sender: {
        id: Number(message.senderId),
        username: message.senderUsername,
        displayName: message.senderDisplayName,
        mobile: message.senderMobile,
        avatarUrl: message.senderAvatarUrl,
      },
    }));

    const chat = {
      ...chatRow,
      id: Number(chatRow.id),
      ownerId: chatRow.ownerId == null ? null : Number(chatRow.ownerId),
      participants,
    };

    return response.json({
      chat: { ...chat, displayTitle: chatLabel(chat, participants) },
      messages: selected,
      hasMore,
      nextBefore: selected[0]?.id || null,
    });
  }));

  return router;
}
