import crypto from 'node:crypto';
import express from 'express';
import { sqlite } from './db.js';
import { auth } from './auth.js';
import { route } from './feature-state.js';
import { getFeatureIo } from './feature-io.js';

const now = () => Date.now();

sqlite.exec(`
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE(blocker_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS user_privacy (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen TEXT NOT NULL DEFAULT 'everyone',
  read_receipts INTEGER NOT NULL DEFAULT 1,
  allow_messages TEXT NOT NULL DEFAULT 'everyone',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  meta_json TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, source_type, source_id)
);
CREATE TABLE IF NOT EXISTS invite_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_roles (
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  updated_at INTEGER NOT NULL,
  UNIQUE(chat_id,user_id)
);
CREATE TABLE IF NOT EXISTS pinned_messages (
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by INTEGER NOT NULL REFERENCES users(id),
  pinned_at INTEGER NOT NULL,
  UNIQUE(chat_id,message_id)
);
CREATE TABLE IF NOT EXISTS rss_categories (
  chat_id INTEGER PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Custom',
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS saved_items_user_idx ON saved_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invites_chat_idx ON invite_links(chat_id, revoked_at);
`);

function hasColumn(tableName, columnName) {
  return sqlite.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
}

function addColumn(tableName, columnName, definition) {
  if (!hasColumn(tableName, columnName)) sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

addColumn('messages', 'delivered_at', 'INTEGER');
addColumn('messages', 'failed_at', 'INTEGER');
addColumn('messages', 'forwarded_from_id', 'INTEGER');
addColumn('chats', 'description', 'TEXT');
addColumn('chats', 'pinned_message_id', 'INTEGER');

function requireMember(chatId, userId) {
  const member = sqlite.prepare('SELECT * FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, userId);
  if (!member) {
    const error = new Error('You are not a member of this chat.');
    error.status = 403;
    throw error;
  }
  return member;
}

function requireAdmin(chatId, userId) {
  const chat = sqlite.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  const role = sqlite.prepare('SELECT role FROM chat_roles WHERE chat_id=? AND user_id=?').get(chatId, userId)?.role;
  if (!chat || (chat.owner_id !== userId && role !== 'owner' && role !== 'admin')) {
    const error = new Error('Admin access is required.');
    error.status = 403;
    throw error;
  }
  return chat;
}

function messagePayload(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    type: row.type,
    body: row.body,
    fileName: row.file_name,
    fileUrl: row.file_path ? `/uploads/${row.file_path.split('/').pop()}` : null,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    replyToId: row.reply_to_id,
    forwardedFromId: row.forwarded_from_id,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    deliveredAt: row.delivered_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
  };
}

export function createFeaturePackRouter() {
  const router = express.Router();

  router.get('/chats/:id/search', auth, route(async (req, res) => {
    const chatId = Number(req.params.id);
    const q = String(req.query.q || '').trim();
    requireMember(chatId, req.user.id);
    if (!q) return res.json({ messages: [] });
    const rows = sqlite.prepare(`
      SELECT * FROM messages
      WHERE chat_id=? AND deleted_at IS NULL AND body LIKE ?
      ORDER BY created_at DESC, id DESC
      LIMIT 50
    `).all(chatId, `%${q}%`);
    return res.json({ messages: rows.map(messagePayload) });
  }));

  router.get('/chats/:id/info', auth, route(async (req, res) => {
    const chatId = Number(req.params.id);
    requireMember(chatId, req.user.id);
    const chat = sqlite.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
    const members = sqlite.prepare(`
      SELECT u.id,u.username,u.display_name,u.avatar_url,COALESCE(cr.role, CASE WHEN c.owner_id=u.id THEN 'owner' ELSE 'member' END) role
      FROM chat_members cm
      JOIN users u ON u.id=cm.user_id
      JOIN chats c ON c.id=cm.chat_id
      LEFT JOIN chat_roles cr ON cr.chat_id=cm.chat_id AND cr.user_id=cm.user_id
      WHERE cm.chat_id=?
      ORDER BY role DESC, u.display_name, u.username
    `).all(chatId);
    const pinned = chat.pinned_message_id ? sqlite.prepare('SELECT * FROM messages WHERE id=?').get(chat.pinned_message_id) : null;
    const invites = sqlite.prepare('SELECT code, revoked_at, created_at FROM invite_links WHERE chat_id=? ORDER BY created_at DESC LIMIT 5').all(chatId);
    return res.json({ chat, members, pinnedMessage: pinned ? messagePayload(pinned) : null, invites });
  }));

  router.post('/chats/:id/typing', auth, route(async (req, res) => {
    const chatId = Number(req.params.id);
    requireMember(chatId, req.user.id);
    const isTyping = Boolean(req.body?.typing);
    getFeatureIo()?.to(`chat:${chatId}`).emit('typing:update', {
      chatId,
      userId: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      typing: isTyping,
      at: now(),
    });
    return res.json({ ok: true });
  }));

  router.post('/messages/:id/forward', auth, route(async (req, res) => {
    const sourceId = Number(req.params.id);
    const targetChatId = Number(req.body?.chatId);
    const source = sqlite.prepare('SELECT * FROM messages WHERE id=? AND deleted_at IS NULL').get(sourceId);
    if (!source) return res.status(404).json({ error: 'Message not found.' });
    requireMember(source.chat_id, req.user.id);
    requireMember(targetChatId, req.user.id);
    const createdAt = now();
    const clientId = `forward-${crypto.randomUUID()}`;
    const info = sqlite.prepare(`
      INSERT INTO messages (client_id,chat_id,sender_id,type,body,file_name,file_path,mime_type,file_size,forwarded_from_id,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(clientId, targetChatId, req.user.id, source.type, source.body, source.file_name, source.file_path, source.mime_type, source.file_size, source.id, createdAt);
    sqlite.prepare('UPDATE chats SET updated_at=? WHERE id=?').run(createdAt, targetChatId);
    const message = sqlite.prepare('SELECT * FROM messages WHERE id=?').get(info.lastInsertRowid);
    getFeatureIo()?.to(`chat:${targetChatId}`).emit('message:new', messagePayload(message));
    return res.json({ message: messagePayload(message) });
  }));

  router.patch('/messages/:id/status', auth, route(async (req, res) => {
    const messageId = Number(req.params.id);
    const message = sqlite.prepare('SELECT * FROM messages WHERE id=?').get(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found.' });
    requireMember(message.chat_id, req.user.id);
    const status = String(req.body?.status || 'delivered');
    const at = now();
    if (status === 'failed') sqlite.prepare('UPDATE messages SET failed_at=? WHERE id=?').run(at, messageId);
    else sqlite.prepare('UPDATE messages SET delivered_at=COALESCE(delivered_at,?) WHERE id=?').run(at, messageId);
    const updated = sqlite.prepare('SELECT * FROM messages WHERE id=?').get(messageId);
    getFeatureIo()?.to(`chat:${message.chat_id}`).emit('message:status', messagePayload(updated));
    return res.json({ message: messagePayload(updated) });
  }));

  router.post('/messages/:id/pin', auth, route(async (req, res) => {
    const messageId = Number(req.params.id);
    const message = sqlite.prepare('SELECT * FROM messages WHERE id=?').get(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found.' });
    requireAdmin(message.chat_id, req.user.id);
    const at = now();
    sqlite.prepare('INSERT OR IGNORE INTO pinned_messages (chat_id,message_id,pinned_by,pinned_at) VALUES (?,?,?,?)').run(message.chat_id, message.id, req.user.id, at);
    sqlite.prepare('UPDATE chats SET pinned_message_id=? WHERE id=?').run(message.id, message.chat_id);
    getFeatureIo()?.to(`chat:${message.chat_id}`).emit('chat:pinned-message', { chatId: message.chat_id, message: messagePayload(message) });
    return res.json({ message: messagePayload(message) });
  }));

  router.delete('/chats/:id/pinned-message', auth, route(async (req, res) => {
    const chatId = Number(req.params.id);
    requireAdmin(chatId, req.user.id);
    sqlite.prepare('UPDATE chats SET pinned_message_id=NULL WHERE id=?').run(chatId);
    getFeatureIo()?.to(`chat:${chatId}`).emit('chat:pinned-message', { chatId, message: null });
    return res.json({ ok: true });
  }));

  router.post('/saved-items', auth, route(async (req, res) => {
    const sourceType = String(req.body?.sourceType || 'link');
    const sourceId = String(req.body?.sourceId || req.body?.url || crypto.randomUUID());
    const title = req.body?.title ? String(req.body.title) : null;
    const url = req.body?.url ? String(req.body.url) : null;
    const meta = req.body?.meta ? JSON.stringify(req.body.meta) : null;
    sqlite.prepare('INSERT OR IGNORE INTO saved_items (user_id,source_type,source_id,title,url,meta_json,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(req.user.id, sourceType, sourceId, title, url, meta, now());
    return res.json({ ok: true });
  }));

  router.get('/saved-items', auth, route(async (req, res) => {
    const items = sqlite.prepare('SELECT * FROM saved_items WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
    return res.json({ items });
  }));

  router.delete('/saved-items/:id', auth, route(async (req, res) => {
    sqlite.prepare('DELETE FROM saved_items WHERE id=? AND user_id=?').run(Number(req.params.id), req.user.id);
    return res.json({ ok: true });
  }));

  router.get('/privacy', auth, route(async (req, res) => {
    const privacy = sqlite.prepare('SELECT * FROM user_privacy WHERE user_id=?').get(req.user.id)
      || { user_id: req.user.id, last_seen: 'everyone', read_receipts: 1, allow_messages: 'everyone' };
    const blocked = sqlite.prepare('SELECT u.id,u.username,u.display_name,u.avatar_url FROM user_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=?').all(req.user.id);
    return res.json({ privacy, blocked });
  }));

  router.patch('/privacy', auth, route(async (req, res) => {
    const lastSeen = ['everyone', 'nobody'].includes(req.body?.lastSeen) ? req.body.lastSeen : 'everyone';
    const allowMessages = ['everyone', 'contacts'].includes(req.body?.allowMessages) ? req.body.allowMessages : 'everyone';
    const readReceipts = req.body?.readReceipts === false ? 0 : 1;
    sqlite.prepare(`
      INSERT INTO user_privacy (user_id,last_seen,read_receipts,allow_messages,updated_at)
      VALUES (?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen,read_receipts=excluded.read_receipts,allow_messages=excluded.allow_messages,updated_at=excluded.updated_at
    `).run(req.user.id, lastSeen, readReceipts, allowMessages, now());
    return res.json({ ok: true });
  }));

  router.post('/users/:id/block', auth, route(async (req, res) => {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) return res.status(400).json({ error: 'You cannot block yourself.' });
    sqlite.prepare('INSERT OR IGNORE INTO user_blocks (blocker_id,blocked_id,created_at) VALUES (?,?,?)').run(req.user.id, targetId, now());
    return res.json({ ok: true });
  }));

  router.delete('/users/:id/block', auth, route(async (req, res) => {
    sqlite.prepare('DELETE FROM user_blocks WHERE blocker_id=? AND blocked_id=?').run(req.user.id, Number(req.params.id));
    return res.json({ ok: true });
  }));

  router.get('/sessions', auth, route(async (req, res) => {
    const sessions = sqlite.prepare('SELECT id,expires_at,last_used_at,created_at FROM sessions WHERE user_id=? ORDER BY last_used_at DESC').all(req.user.id);
    return res.json({ sessions });
  }));

  router.delete('/sessions/:id', auth, route(async (req, res) => {
    sqlite.prepare('DELETE FROM sessions WHERE user_id=? AND id=?').run(req.user.id, String(req.params.id));
    return res.json({ ok: true });
  }));

  router.post('/chats/:id/invites', auth, route(async (req, res) => {
    const chatId = Number(req.params.id);
    requireAdmin(chatId, req.user.id);
    const code = crypto.randomBytes(10).toString('base64url');
    sqlite.prepare('INSERT INTO invite_links (chat_id,code,created_by,created_at) VALUES (?,?,?,?)').run(chatId, code, req.user.id, now());
    return res.json({ invite: { code, url: `/invite/${code}` } });
  }));

  router.post('/invites/:code/join', auth, route(async (req, res) => {
    const invite = sqlite.prepare('SELECT * FROM invite_links WHERE code=? AND revoked_at IS NULL').get(String(req.params.code));
    if (!invite) return res.status(404).json({ error: 'Invite not found.' });
    const at = now();
    sqlite.prepare('INSERT OR IGNORE INTO chat_members (chat_id,user_id,joined_at) VALUES (?,?,?)').run(invite.chat_id, req.user.id, at);
    sqlite.prepare('INSERT OR IGNORE INTO chat_roles (chat_id,user_id,role,updated_at) VALUES (?,?,?,?)').run(invite.chat_id, req.user.id, 'member', at);
    return res.json({ chatId: invite.chat_id });
  }));

  router.patch('/chats/:id/roles/:userId', auth, route(async (req, res) => {
    const chatId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    requireAdmin(chatId, req.user.id);
    const role = ['admin', 'member'].includes(req.body?.role) ? req.body.role : 'member';
    sqlite.prepare('INSERT INTO chat_roles (chat_id,user_id,role,updated_at) VALUES (?,?,?,?) ON CONFLICT(chat_id,user_id) DO UPDATE SET role=excluded.role,updated_at=excluded.updated_at')
      .run(chatId, targetId, role, now());
    return res.json({ ok: true });
  }));

  router.patch('/chats/:id/rss-category', auth, route(async (req, res) => {
    const chatId = Number(req.params.id);
    requireAdmin(chatId, req.user.id);
    const category = String(req.body?.category || 'Custom').slice(0, 40);
    sqlite.prepare('INSERT INTO rss_categories (chat_id,category,updated_at) VALUES (?,?,?) ON CONFLICT(chat_id) DO UPDATE SET category=excluded.category,updated_at=excluded.updated_at')
      .run(chatId, category, now());
    return res.json({ category });
  }));

  return router;
}
