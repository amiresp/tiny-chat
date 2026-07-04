import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import argon2 from 'argon2';
import Parser from 'rss-parser';
import { Server } from 'socket.io';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { db } from './db.js';
import { users, chats, chatMembers, messages, receipts } from './schema.js';
import { auth, createSession, socketAuth } from './auth.js';
import { scheduleCleanup } from './cleanup.js';

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function checkOrigin(requestOrigin, callback) {
  if (!requestOrigin || allowedOrigins.includes(requestOrigin) || (requestOrigin === 'null' && allowedOrigins.includes('null'))) {
    callback(null, true);
    return;
  }
  callback(new Error(`Origin ${requestOrigin} is not allowed`));
}

const io = new Server(server, {
  cors: {
    origin: checkOrigin,
    credentials: true,
  },
});

const uploadDir = process.env.UPLOAD_DIR || './storage/uploads';
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_request, file, callback) => callback(
      null,
      `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`,
    ),
  }),
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE_MB || 50) * 1024 * 1024,
  },
});

const parser = new Parser({ timeout: 10_000 });

function publishNewChat(chat, memberIds) {
  for (const memberId of memberIds) {
    const room = `user:${memberId}`;
    io.in(room).socketsJoin(`chat:${chat.id}`);
    io.to(room).emit('chat:new', chat);
  }
}

app.use(cors({ origin: checkOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadDir, { fallthrough: false, maxAge: '1h' }));
app.get('/health', (_request, response) => response.json({
  ok: true,
  status: 'healthy',
  time: new Date().toISOString(),
}));

app.post('/api/auth/register', async (request, response) => {
  try {
    const { username, mobile, password } = request.body;
    if (!username || !mobile || String(password).length < 8) {
      return response.status(400).json({ error: 'Username, mobile and an 8+ character password are required' });
    }

    const [{ count }] = await db.select({ count: sql`count(*)` }).from(users);
    const [user] = await db.insert(users).values({
      username: username.trim().toLowerCase(),
      mobile: mobile.trim(),
      passwordHash: await argon2.hash(password),
      role: Number(count) === 0 ? 'admin' : 'user',
      createdAt: new Date(),
    }).returning();

    return response.status(201).json({
      token: await createSession(user.id),
      user: { ...user, passwordHash: undefined },
    });
  } catch {
    return response.status(409).json({ error: 'Username or mobile already exists' });
  }
});

app.post('/api/auth/login', async (request, response) => {
  const { identity, password } = request.body;
  const [user] = await db.select().from(users).where(or(
    eq(users.username, String(identity).toLowerCase()),
    eq(users.mobile, String(identity)),
  )).limit(1);

  if (!user || user.isBanned || !await argon2.verify(user.passwordHash, password)) {
    return response.status(401).json({ error: 'Invalid credentials' });
  }

  return response.json({
    token: await createSession(user.id),
    user: { ...user, passwordHash: undefined },
  });
});

app.get('/api/me', auth, (request, response) => response.json({
  user: { ...request.user, passwordHash: undefined },
}));

app.patch('/api/me', auth, async (request, response) => {
  const allowed = {
    displayName: request.body.displayName,
    username: request.body.username?.toLowerCase(),
    mobile: request.body.mobile,
    hidePresence: request.body.hidePresence,
  };
  Object.keys(allowed).forEach((key) => allowed[key] === undefined && delete allowed[key]);
  const [user] = await db.update(users).set(allowed).where(eq(users.id, request.user.id)).returning();
  response.json({ user: { ...user, passwordHash: undefined } });
});

app.patch('/api/me/password', auth, async (request, response) => {
  if (!await argon2.verify(request.user.passwordHash, request.body.currentPassword)) {
    return response.status(400).json({ error: 'Current password is incorrect' });
  }
  await db.update(users).set({ passwordHash: await argon2.hash(request.body.newPassword) }).where(eq(users.id, request.user.id));
  return response.json({ ok: true });
});

app.get('/api/users/search', auth, async (request, response) => {
  const query = `%${String(request.query.q || '')}%`;
  const list = await db.select({
    id: users.id,
    username: users.username,
    mobile: users.mobile,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
    lastSeenAt: users.lastSeenAt,
    hidePresence: users.hidePresence,
  }).from(users).where(and(
    eq(users.isBanned, false),
    or(like(users.username, query), like(users.mobile, query)),
  )).limit(30);
  response.json({ users: list });
});

app.post('/api/chats/direct', auth, async (request, response) => {
  const target = Number(request.body.userId);
  if (!Number.isInteger(target) || target <= 0 || target === request.user.id) {
    return response.status(400).json({ error: 'Select a valid user' });
  }

  const [targetUser] = await db.select({ id: users.id }).from(users).where(and(
    eq(users.id, target),
    eq(users.isBanned, false),
  )).limit(1);
  if (!targetUser) return response.status(404).json({ error: 'User not found' });

  const now = new Date();
  const memberIds = [request.user.id, target];
  const [chat] = await db.insert(chats).values({
    type: 'direct',
    ownerId: request.user.id,
    createdAt: now,
    updatedAt: now,
  }).returning();
  await db.insert(chatMembers).values(memberIds.map((userId) => ({ chatId: chat.id, userId, joinedAt: now })));
  publishNewChat(chat, memberIds);
  return response.status(201).json({ chat });
});

app.post('/api/chats/group', auth, async (request, response) => {
  const now = new Date();
  const memberIds = [...new Set([
    request.user.id,
    ...(request.body.memberIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0),
  ])];
  const [chat] = await db.insert(chats).values({
    type: 'group',
    title: String(request.body.title || 'New group').trim() || 'New group',
    ownerId: request.user.id,
    createdAt: now,
    updatedAt: now,
  }).returning();
  await db.insert(chatMembers).values(memberIds.map((userId) => ({ chatId: chat.id, userId, joinedAt: now })));
  publishNewChat(chat, memberIds);
  return response.status(201).json({ chat });
});

app.post('/api/chats/rss', auth, async (request, response) => {
  try {
    const feed = await parser.parseURL(request.body.url);
    const now = new Date();
    const [chat] = await db.insert(chats).values({
      type: 'rss',
      title: String(request.body.title || feed.title || request.body.url).trim(),
      rssUrl: request.body.url,
      ownerId: request.user.id,
      createdAt: now,
      updatedAt: now,
    }).returning();
    await db.insert(chatMembers).values({ chatId: chat.id, userId: request.user.id, joinedAt: now });
    publishNewChat(chat, [request.user.id]);
    return response.status(201).json({ chat });
  } catch (error) {
    return response.status(400).json({ error: error.message || 'Invalid or unavailable RSS feed' });
  }
});

app.get('/api/chats', auth, async (request, response) => {
  const list = await db.select({
    id: chats.id,
    type: chats.type,
    title: chats.title,
    avatarUrl: chats.avatarUrl,
    ownerId: chats.ownerId,
    rssUrl: chats.rssUrl,
    updatedAt: chats.updatedAt,
  }).from(chats)
    .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    .where(and(
      eq(chatMembers.userId, request.user.id),
      sql`${chatMembers.hiddenAt} IS NULL`,
    ))
    .orderBy(desc(chats.updatedAt));
  response.json({ chats: list });
});

app.post('/api/chats/:id/members', auth, async (request, response) => {
  const chatId = Number(request.params.id);
  const userId = Number(request.body.userId);
  const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
  if (!chat || chat.ownerId !== request.user.id) return response.status(403).json({ error: 'Owner only' });
  await db.insert(chatMembers).values({ chatId, userId, joinedAt: new Date() }).onConflictDoNothing();
  publishNewChat(chat, [userId]);
  return response.json({ ok: true });
});

app.delete('/api/chats/:id', auth, async (request, response) => {
  await db.update(chatMembers).set({ hiddenAt: new Date() }).where(and(
    eq(chatMembers.chatId, Number(request.params.id)),
    eq(chatMembers.userId, request.user.id),
  ));
  response.json({ ok: true, deleteAfterDays: 7 });
});

app.get('/api/chats/:id/search', auth, async (request, response) => {
  const chatId = Number(request.params.id);
  const query = `%${String(request.query.q || '')}%`;
  const [membership] = await db.select().from(chatMembers).where(and(
    eq(chatMembers.chatId, chatId),
    eq(chatMembers.userId, request.user.id),
  )).limit(1);
  if (!membership) return response.status(403).json({ error: 'Not a member' });
  return response.json({
    messages: await db.select().from(messages).where(and(
      eq(messages.chatId, chatId),
      like(messages.body, query),
    )).orderBy(desc(messages.createdAt)).limit(100),
  });
});

app.get('/api/admin/chats/:id/messages', auth, async (request, response) => {
  if (request.user.role !== 'admin') return response.status(403).json({ error: 'Admin only' });
  return response.json({
    messages: await db.select().from(messages)
      .where(eq(messages.chatId, Number(request.params.id)))
      .orderBy(messages.createdAt),
  });
});

app.get('/api/chats/:id/messages', auth, async (request, response) => {
  const chatId = Number(request.params.id);
  const [membership] = await db.select().from(chatMembers).where(and(
    eq(chatMembers.chatId, chatId),
    eq(chatMembers.userId, request.user.id),
  )).limit(1);
  if (!membership) return response.status(403).json({ error: 'Not a member' });

  const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
  if (chat.type === 'rss') {
    try {
      const feed = await parser.parseURL(chat.rssUrl);
      return response.json({
        rss: true,
        items: (feed.items || []).slice(0, 100).map((item, index) => ({
          id: `rss-${index}`,
          title: item.title,
          body: item.contentSnippet || item.content || '',
          link: item.link,
          createdAt: item.isoDate || item.pubDate,
        })),
      });
    } catch (error) {
      return response.status(502).json({ error: error.message || 'RSS refresh failed' });
    }
  }

  const rows = await db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.createdAt);
  return response.json({
    messages: rows.map((item) => ({
      ...item,
      fileUrl: item.filePath ? `/uploads/${path.basename(item.filePath)}` : null,
      fileExpired: Boolean(item.fileExpiredAt),
    })),
  });
});

app.post('/api/chats/:id/files', auth, upload.single('file'), async (request, response) => {
  const now = new Date();
  const [message] = await db.insert(messages).values({
    clientId: request.body.clientId || crypto.randomUUID(),
    chatId: Number(request.params.id),
    senderId: request.user.id,
    type: request.body.type || 'file',
    body: request.body.body || null,
    fileName: request.file.originalname,
    filePath: request.file.path,
    mimeType: request.file.mimetype,
    fileSize: request.file.size,
    createdAt: now,
  }).returning();
  await db.update(chats).set({ updatedAt: now }).where(eq(chats.id, message.chatId));
  io.to(`chat:${message.chatId}`).emit('message:new', message);
  return response.status(201).json({ message });
});

app.get('/api/admin/users', auth, async (request, response) => {
  if (request.user.role !== 'admin') return response.status(403).json({ error: 'Admin only' });
  return response.json({
    users: (await db.select().from(users)).map((item) => ({ ...item, passwordHash: undefined })),
  });
});

app.patch('/api/admin/users/:id/ban', auth, async (request, response) => {
  if (request.user.role !== 'admin') return response.status(403).json({ error: 'Admin only' });
  if (Number(request.params.id) === request.user.id) return response.status(400).json({ error: 'Cannot ban yourself' });
  await db.update(users).set({ isBanned: Boolean(request.body.banned) }).where(eq(users.id, Number(request.params.id)));
  return response.json({ ok: true });
});

app.get('/api/admin/chats', auth, async (request, response) => {
  if (request.user.role !== 'admin') return response.status(403).json({ error: 'Admin only' });
  return response.json({ chats: await db.select().from(chats).orderBy(desc(chats.updatedAt)) });
});

io.use(socketAuth);
const online = new Map();
io.on('connection', async (socket) => {
  const userId = Number(socket.authPayload.sub);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || user.isBanned) return socket.disconnect();

  online.set(userId, (online.get(userId) || 0) + 1);
  socket.join(`user:${userId}`);
  const memberships = await db.select().from(chatMembers).where(eq(chatMembers.userId, userId));
  memberships.forEach((membership) => socket.join(`chat:${membership.chatId}`));
  if (!user.hidePresence) io.emit('presence', { userId, status: 'online' });

  socket.on('message:send', async (payload, acknowledge = () => {}) => {
    try {
      const now = new Date();
      const [member] = await db.select().from(chatMembers).where(and(
        eq(chatMembers.chatId, Number(payload.chatId)),
        eq(chatMembers.userId, userId),
      )).limit(1);
      if (!member) throw new Error('Not a member');

      const [message] = await db.insert(messages).values({
        clientId: payload.clientId,
        chatId: Number(payload.chatId),
        senderId: userId,
        type: 'text',
        body: String(payload.body || '').slice(0, 10_000),
        createdAt: now,
      }).onConflictDoNothing().returning();

      if (message) {
        await db.update(chats).set({ updatedAt: now }).where(eq(chats.id, message.chatId));
        io.to(`chat:${message.chatId}`).emit('message:new', message);
      }
      acknowledge({ ok: true, message });
    } catch (error) {
      acknowledge({ ok: false, error: error.message });
    }
  });

  socket.on('message:read', async ({ chatId, messageIds }) => {
    const now = new Date();
    for (const messageId of messageIds || []) {
      await db.insert(receipts).values({
        messageId,
        userId,
        deliveredAt: now,
        readAt: now,
      }).onConflictDoUpdate({
        target: [receipts.messageId, receipts.userId],
        set: { readAt: now, deliveredAt: now },
      });
    }
    io.to(`chat:${chatId}`).emit('message:read', { userId, messageIds });
  });

  socket.on('disconnect', () => {
    setTimeout(async () => {
      const count = Math.max(0, (online.get(userId) || 1) - 1);
      if (count) {
        online.set(userId, count);
        return;
      }
      online.delete(userId);
      const lastSeenAt = new Date();
      await db.update(users).set({ lastSeenAt }).where(eq(users.id, userId));
      if (!user.hidePresence) io.emit('presence', { userId, status: 'offline', lastSeenAt });
    }, 10_000);
  });
});

scheduleCleanup();
const port = Number(process.env.PORT || 3001);
server.listen(port, () => console.log(`Verdant server listening on ${port}`));
