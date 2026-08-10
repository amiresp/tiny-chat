import express from 'express';
import { sqlite } from './db.js';
import { auth } from './auth.js';
import { ensureMembership, route } from './feature-state.js';
import { getFeatureIo } from './feature-io.js';

export function createReadStateRouter() {
  const router = express.Router();

  router.post('/chats/:id/read', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    const userId = Number(request.user.id);
    if (!Number.isInteger(chatId) || chatId <= 0) {
      return response.status(400).json({ error: 'Invalid chat.' });
    }
    if (!await ensureMembership(chatId, userId)) {
      return response.status(403).json({ error: 'Not a member' });
    }

    const unread = sqlite.prepare(`
      SELECT m.id
      FROM messages m
      LEFT JOIN receipts r
        ON r.message_id = m.id
        AND r.user_id = ?
      WHERE m.chat_id = ?
        AND m.sender_id <> ?
        AND m.deleted_at IS NULL
        AND r.read_at IS NULL
      ORDER BY m.id ASC
    `).all(userId, chatId, userId);

    if (!unread.length) return response.json({ ok: true, read: 0, messageIds: [] });

    const now = Date.now();
    const upsert = sqlite.prepare(`
      INSERT INTO receipts (message_id, user_id, delivered_at, read_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(message_id,user_id)
      DO UPDATE SET delivered_at = excluded.delivered_at, read_at = excluded.read_at
    `);

    const transaction = sqlite.transaction((rows) => {
      for (const row of rows) upsert.run(row.id, userId, now, now);
    });
    transaction(unread);

    const messageIds = unread.map((row) => Number(row.id));
    const io = getFeatureIo();
    if (io) {
      for (const id of messageIds) {
        io.to(`chat:${chatId}`).emit('message:status', {
          id,
          chatId,
          deliveredAt: now,
          readAt: now,
        });
      }
      io.to(`chat:${chatId}`).emit('message:read', { chatId, userId, messageIds });
    }

    return response.json({ ok: true, read: messageIds.length, messageIds });
  }));

  return router;
}
