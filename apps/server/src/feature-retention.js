import express from 'express';
import { sqlite } from './db.js';

const DELETED_MESSAGE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
let lastCleanupAt = 0;

function purgeExpiredDeletedMessages() {
  const now = Date.now();
  if (now - lastCleanupAt < 60 * 60 * 1000) return;
  lastCleanupAt = now;
  const cutoff = now - DELETED_MESSAGE_RETENTION_MS;
  const expired = sqlite.prepare(`
    SELECT id FROM messages
    WHERE deleted_at IS NOT NULL AND deleted_at < ?
    LIMIT 500
  `).all(cutoff).map((row) => row.id);
  if (!expired.length) return;

  const placeholders = expired.map(() => '?').join(',');
  const tx = sqlite.transaction((ids) => {
    sqlite.prepare(`DELETE FROM receipts WHERE message_id IN (${placeholders})`).run(...ids);
    sqlite.prepare(`DELETE FROM message_reactions WHERE message_id IN (${placeholders})`).run(...ids);
    sqlite.prepare(`DELETE FROM pinned_messages WHERE message_id IN (${placeholders})`).run(...ids);
    sqlite.prepare(`UPDATE chats SET pinned_message_id = NULL WHERE pinned_message_id IN (${placeholders})`).run(...ids);
    sqlite.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`).run(...ids);
  });
  tx(expired);
}

export function createRetentionRouter() {
  const router = express.Router();
  router.use((request, response, next) => {
    try {
      purgeExpiredDeletedMessages();
    } catch (error) {
      console.error('Deleted message retention cleanup failed:', error);
    }
    next();
  });
  return router;
}
