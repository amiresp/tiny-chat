import express from 'express';
import { auth } from './auth.js';
import { sqlite } from './db.js';
import { getOnlineEntry, route } from './feature-state.js';

function directPeerPayload(row) {
  if (!row.peer_id) return null;
  const entry = getOnlineEntry(row.peer_id);
  const hidePresence = Boolean(row.peer_hide_presence);
  return {
    id: row.peer_id,
    username: row.peer_username,
    displayName: row.peer_display_name,
    avatarUrl: row.peer_avatar_url,
    hidePresence,
    lastSeenAt: hidePresence ? null : row.peer_last_seen_at,
    isOnline: Boolean(entry && !entry.hidden && !hidePresence),
  };
}

function hiddenChatPayload(row) {
  const peer = row.type === 'direct' ? directPeerPayload(row) : null;
  const title = row.type === 'saved'
    ? 'Saved Messages'
    : row.type === 'direct'
      ? (peer?.displayName || peer?.username || row.title || 'Direct chat')
      : (row.title || `${row.type} chat`);

  return {
    id: row.id,
    type: row.type,
    title,
    avatarUrl: row.type === 'direct' ? (peer?.avatarUrl || null) : row.avatar_url,
    ownerId: row.owner_id,
    rssUrl: row.rss_url,
    updatedAt: row.updated_at,
    pinnedAt: row.pinned_at,
    archivedAt: row.archived_at,
    mutedUntil: row.muted_until,
    hiddenAt: row.hidden_at,
    pinned: row.type === 'saved' ? true : Boolean(row.pinned_at),
    archived: Boolean(row.archived_at),
    muted: Boolean(row.muted_until && Number(row.muted_until) > Date.now()),
    hidden: true,
    unreadCount: Number(row.unread_count || 0),
    lastMessageBody: row.last_message_body,
    lastMessageFileName: row.last_message_file_name,
    lastMessageType: row.last_message_type,
    lastMessageAt: row.last_message_at,
    lastMessageSenderId: row.last_message_sender_id,
    peer,
  };
}

export function createHiddenChatsRouter() {
  const router = express.Router();

  router.get('/chats/hidden', auth, route(async (request, response) => {
    const userId = Number(request.user.id);
    const rows = sqlite.prepare(`
      SELECT
        c.id,
        c.type,
        c.title,
        c.avatar_url,
        c.owner_id,
        c.rss_url,
        c.updated_at,
        cm.pinned_at,
        cm.archived_at,
        cm.muted_until,
        cm.hidden_at,
        peer.id AS peer_id,
        peer.username AS peer_username,
        peer.display_name AS peer_display_name,
        peer.avatar_url AS peer_avatar_url,
        peer.hide_presence AS peer_hide_presence,
        peer.last_seen_at AS peer_last_seen_at,
        (
          SELECT COUNT(*)
          FROM messages unread_messages
          LEFT JOIN receipts unread_receipts
            ON unread_receipts.message_id = unread_messages.id
            AND unread_receipts.user_id = ?
          WHERE unread_messages.chat_id = c.id
            AND unread_messages.sender_id <> ?
            AND unread_messages.deleted_at IS NULL
            AND unread_receipts.read_at IS NULL
        ) AS unread_count,
        (
          SELECT body FROM messages
          WHERE chat_id = c.id AND deleted_at IS NULL
          ORDER BY id DESC LIMIT 1
        ) AS last_message_body,
        (
          SELECT file_name FROM messages
          WHERE chat_id = c.id AND deleted_at IS NULL
          ORDER BY id DESC LIMIT 1
        ) AS last_message_file_name,
        (
          SELECT type FROM messages
          WHERE chat_id = c.id AND deleted_at IS NULL
          ORDER BY id DESC LIMIT 1
        ) AS last_message_type,
        (
          SELECT created_at FROM messages
          WHERE chat_id = c.id AND deleted_at IS NULL
          ORDER BY id DESC LIMIT 1
        ) AS last_message_at,
        (
          SELECT sender_id FROM messages
          WHERE chat_id = c.id AND deleted_at IS NULL
          ORDER BY id DESC LIMIT 1
        ) AS last_message_sender_id
      FROM chats c
      INNER JOIN chat_members cm
        ON cm.chat_id = c.id AND cm.user_id = ?
      LEFT JOIN chat_members peer_cm
        ON peer_cm.chat_id = c.id
        AND peer_cm.user_id <> ?
        AND c.type = 'direct'
      LEFT JOIN users peer ON peer.id = peer_cm.user_id
      WHERE cm.hidden_at IS NOT NULL
      ORDER BY cm.pinned_at DESC, c.updated_at DESC
    `).all(userId, userId, userId, userId);

    return response.json({ chats: rows.map(hiddenChatPayload) });
  }));

  router.patch('/chats/:id/hidden', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    const userId = Number(request.user.id);
    const member = sqlite.prepare(`
      SELECT cm.hidden_at, c.type
      FROM chat_members cm
      INNER JOIN chats c ON c.id = cm.chat_id
      WHERE cm.chat_id = ? AND cm.user_id = ?
    `).get(chatId, userId);

    if (!member) return response.status(403).json({ error: 'Not a member' });
    if (member.type === 'saved') return response.status(400).json({ error: 'Saved Messages cannot be hidden' });

    const hidden = request.body?.hidden === undefined
      ? !member.hidden_at
      : Boolean(request.body.hidden);
    const hiddenAt = hidden ? Date.now() : null;

    sqlite.prepare(`
      UPDATE chat_members
      SET hidden_at = ?
      WHERE chat_id = ? AND user_id = ?
    `).run(hiddenAt, chatId, userId);

    return response.json({ hidden, hiddenAt });
  }));

  return router;
}
