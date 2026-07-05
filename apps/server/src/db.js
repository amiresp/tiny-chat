import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

const file = process.env.DATABASE_PATH || './data/verdant.db';
fs.mkdirSync(path.dirname(file), { recursive: true });

export const sqlite = new Database(file);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  is_banned INTEGER NOT NULL DEFAULT 0,
  hide_presence INTEGER NOT NULL DEFAULT 0,
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT,
  avatar_url TEXT,
  owner_id INTEGER REFERENCES users(id),
  rss_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_members (
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_at INTEGER,
  joined_at INTEGER NOT NULL,
  pinned_at INTEGER,
  archived_at INTEGER,
  muted_until INTEGER,
  UNIQUE(chat_id,user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL UNIQUE,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  file_name TEXT,
  file_path TEXT,
  mime_type TEXT,
  file_size INTEGER,
  file_expired_at INTEGER,
  reply_to_id INTEGER,
  edited_at INTEGER,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS message_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(message_id,user_id,emoji)
);
CREATE TABLE IF NOT EXISTS receipts (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at INTEGER,
  read_at INTEGER,
  UNIQUE(message_id,user_id)
);
CREATE INDEX IF NOT EXISTS messages_chat_created_idx ON messages(chat_id, created_at DESC, id DESC);
`);

function hasColumn(tableName, columnName) {
  return sqlite.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
}

function addColumn(tableName, columnName, definition) {
  if (!hasColumn(tableName, columnName)) {
    sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

addColumn('chat_members', 'pinned_at', 'INTEGER');
addColumn('chat_members', 'archived_at', 'INTEGER');
addColumn('chat_members', 'muted_until', 'INTEGER');
addColumn('messages', 'reply_to_id', 'INTEGER');
addColumn('messages', 'edited_at', 'INTEGER');
addColumn('messages', 'deleted_at', 'INTEGER');

sqlite.exec(`
CREATE INDEX IF NOT EXISTS messages_chat_media_idx ON messages(chat_id, mime_type, id DESC);
CREATE INDEX IF NOT EXISTS reactions_message_idx ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS chat_members_user_state_idx ON chat_members(user_id, archived_at, pinned_at);
`);

export const db = drizzle(sqlite, { schema });
