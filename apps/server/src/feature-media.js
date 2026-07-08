import path from 'node:path';
import express from 'express';
import { auth } from './auth.js';
import { sqlite } from './db.js';
import { ensureMembership, route } from './feature-state.js';

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return Math.min(number, maximum);
}

function fileUrl(filePath) {
  if (!filePath) return null;
  return `/uploads/${path.relative(uploadDir, filePath).replaceAll(path.sep, '/')}`;
}

function mediaItem(row) {
  return {
    id: row.id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    type: row.type,
    fileName: row.file_name,
    fileUrl: fileUrl(row.file_path),
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  };
}

export function createMediaFeatureRouter() {
  const router = express.Router();

  router.get('/chats/:id/media', auth, route(async (request, response) => {
    const chatId = Number(request.params.id);
    if (!Number.isInteger(chatId) || chatId <= 0) {
      return response.status(400).json({ error: 'Invalid chat id.' });
    }
    if (!await ensureMembership(chatId, request.user.id)) {
      return response.status(403).json({ error: 'Not a member' });
    }

    const limit = positiveInteger(request.query.limit, 30, 60);
    const before = positiveInteger(request.query.before, null);
    const beforeClause = before ? 'AND id < ?' : '';
    const args = before ? [chatId, before, limit + 1] : [chatId, limit + 1];

    const rows = sqlite.prepare(`
      SELECT id, chat_id, sender_id, type, file_name, file_path, mime_type, file_size, created_at
      FROM messages
      WHERE chat_id = ?
        ${beforeClause}
        AND deleted_at IS NULL
        AND file_path IS NOT NULL
        AND (mime_type LIKE 'image/%' OR mime_type LIKE 'video/%')
      ORDER BY id DESC
      LIMIT ?
    `).all(...args);

    const selected = rows.slice(0, limit);
    return response.json({
      items: selected.map(mediaItem),
      hasMore: rows.length > limit,
      nextCursor: rows.length > limit && selected.length ? selected[selected.length - 1].id : null,
    });
  }));

  return router;
}
