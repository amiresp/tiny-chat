import fs from 'node:fs';
import express from 'express';
import { sqlite } from './db.js';
import { auth } from './auth.js';
import { route } from './feature-state.js';
import { getFeatureIo } from './feature-io.js';

function requireAdmin(user) {
  const role = String(user?.role || '').toLowerCase();
  if (!['admin', 'administrator', 'superadmin', 'owner'].includes(role)) {
    const error = new Error('Admin access is required.');
    error.status = 403;
    throw error;
  }
}

function removeUploadedFiles(chatId) {
  const files = sqlite.prepare(`
    SELECT DISTINCT file_path
    FROM messages
    WHERE chat_id = ? AND file_path IS NOT NULL AND file_path <> ''
  `).all(chatId);

  for (const item of files) {
    try {
      if (item.file_path && fs.existsSync(item.file_path)) fs.unlinkSync(item.file_path);
    } catch (error) {
      console.error(`Could not remove uploaded file for chat ${chatId}:`, error);
    }
  }
}

export function createChatManagementRouter() {
  const router = express.Router();

  // User deletion is intentionally account-scoped. The conversation remains
  // available to other members, while it disappears from this user's list.
  router.delete('/chats/:id', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    if (!Number.isInteger(chatId) || chatId <= 0) {
      return response.status(400).json({ error: 'Invalid chat.' });
    }

    const chat = sqlite.prepare('SELECT id, type, title FROM chats WHERE id = ?').get(chatId);
    if (!chat) return response.status(404).json({ error: 'Chat not found.' });
    if (chat.type === 'saved') {
      return response.status(400).json({ error: 'Saved Messages cannot be deleted.' });
    }

    const membership = sqlite.prepare(`
      SELECT chat_id FROM chat_members
      WHERE chat_id = ? AND user_id = ?
    `).get(chatId, request.user.id);
    if (!membership) return response.status(403).json({ error: 'You are not a member of this chat.' });

    const hiddenAt = Date.now();
    sqlite.prepare(`
      UPDATE chat_members
      SET hidden_at = ?, pinned_at = NULL, archived_at = NULL
      WHERE chat_id = ? AND user_id = ?
    `).run(hiddenAt, chatId, request.user.id);

    const io = getFeatureIo();
    io?.to(`user:${request.user.id}`).emit('chat:hidden', { chatId, hiddenAt });
    return response.json({ ok: true, chatId, hiddenAt });
  }));

  router.delete('/admin/chats/:id', auth, route(async (request, response) => {
    requireAdmin(request.user);
    const chatId = Number(request.params.id);
    if (!Number.isInteger(chatId) || chatId <= 0) {
      return response.status(400).json({ error: 'Invalid chat.' });
    }

    const chat = sqlite.prepare('SELECT id, type, title FROM chats WHERE id = ?').get(chatId);
    if (!chat) return response.status(404).json({ error: 'Chat not found.' });

    const memberIds = sqlite.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?').all(chatId).map((row) => row.user_id);
    removeUploadedFiles(chatId);

    const transaction = sqlite.transaction(() => {
      // Tables created by optional features are removed explicitly so the
      // deletion remains safe even if an older database lacks a cascade.
      sqlite.prepare('DELETE FROM invite_links WHERE chat_id = ?').run(chatId);
      sqlite.prepare('DELETE FROM chat_roles WHERE chat_id = ?').run(chatId);
      sqlite.prepare('DELETE FROM pinned_messages WHERE chat_id = ?').run(chatId);
      sqlite.prepare('DELETE FROM rss_categories WHERE chat_id = ?').run(chatId);
      sqlite.prepare('DELETE FROM chats WHERE id = ?').run(chatId);
    });
    transaction();

    const io = getFeatureIo();
    io?.to(`chat:${chatId}`).emit('chat:deleted', { chatId });
    for (const userId of memberIds) io?.to(`user:${userId}`).emit('chat:deleted', { chatId });

    return response.json({ ok: true, chatId, deletedPermanently: true });
  }));

  return router;
}
