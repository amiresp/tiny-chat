import { and, eq, sql } from 'drizzle-orm';
import { db } from './db.js';
import { users, chatMembers } from './schema.js';

const online = new Map();

export const route = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export function getOnlineEntry(userId) {
  return online.get(Number(userId));
}

export function getPublicOnlineIds() {
  return [...online.entries()]
    .filter(([, entry]) => !entry.hidden)
    .map(([userId]) => Number(userId));
}

export function getAllOnlineIds() {
  return [...online.keys()].map(Number);
}

export async function ensureMembership(chatId, userId) {
  const [membership] = await db.select().from(chatMembers).where(and(
    eq(chatMembers.chatId, Number(chatId)),
    eq(chatMembers.userId, Number(userId)),
    sql`${chatMembers.hiddenAt} IS NULL`,
  )).limit(1);
  return membership || null;
}

export function attachFeaturePresence(io) {
  io.on('connection', async (socket) => {
    try {
      const userId = Number(socket.authPayload?.sub);
      if (!Number.isInteger(userId)) return;

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user || user.isBanned) return;

      const current = getOnlineEntry(userId);
      online.set(userId, {
        count: (current?.count || 0) + 1,
        hidden: Boolean(user.hidePresence),
      });

      socket.on('disconnect', () => {
        const entry = getOnlineEntry(userId);
        const nextCount = Math.max(0, (entry?.count || 1) - 1);
        if (nextCount) online.set(userId, { ...entry, count: nextCount });
        else online.delete(userId);
      });
    } catch (error) {
      console.error('Feature presence error:', error);
    }
  });
}
