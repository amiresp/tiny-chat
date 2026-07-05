import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  mobile: text('mobile').notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('user'),
  isBanned: integer('is_banned', { mode: 'boolean' }).notNull().default(false),
  hidePresence: integer('hide_presence', { mode: 'boolean' }).notNull().default(false),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  usernameIdx: uniqueIndex('users_username_uq').on(table.username),
  mobileIdx: uniqueIndex('users_mobile_uq').on(table.mobile),
}));

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const chats = sqliteTable('chats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  title: text('title'),
  avatarUrl: text('avatar_url'),
  ownerId: integer('owner_id').references(() => users.id),
  rssUrl: text('rss_url'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const chatMembers = sqliteTable('chat_members', {
  chatId: integer('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  hiddenAt: integer('hidden_at', { mode: 'timestamp_ms' }),
  joinedAt: integer('joined_at', { mode: 'timestamp_ms' }).notNull(),
  pinnedAt: integer('pinned_at', { mode: 'timestamp_ms' }),
  archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  mutedUntil: integer('muted_until', { mode: 'timestamp_ms' }),
}, (table) => ({
  memberUq: uniqueIndex('chat_members_uq').on(table.chatId, table.userId),
}));

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: text('client_id').notNull(),
  chatId: integer('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  senderId: integer('sender_id').notNull().references(() => users.id),
  type: text('type').notNull().default('text'),
  body: text('body'),
  fileName: text('file_name'),
  filePath: text('file_path'),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  fileExpiredAt: integer('file_expired_at', { mode: 'timestamp_ms' }),
  replyToId: integer('reply_to_id'),
  editedAt: integer('edited_at', { mode: 'timestamp_ms' }),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  clientUq: uniqueIndex('messages_client_uq').on(table.clientId),
}));

export const messageReactions = sqliteTable('message_reactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: integer('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  reactionUq: uniqueIndex('message_reactions_uq').on(table.messageId, table.userId, table.emoji),
}));

export const receipts = sqliteTable('receipts', {
  messageId: integer('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deliveredAt: integer('delivered_at', { mode: 'timestamp_ms' }),
  readAt: integer('read_at', { mode: 'timestamp_ms' }),
}, (table) => ({
  receiptUq: uniqueIndex('receipts_uq').on(table.messageId, table.userId),
}));
