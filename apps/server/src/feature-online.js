import express from 'express';
import { inArray } from 'drizzle-orm';
import { db } from './db.js';
import { users } from './schema.js';
import { auth } from './auth.js';
import {
  getAllOnlineIds,
  getOnlineEntry,
  getPublicOnlineIds,
  publicUser,
  route,
} from './feature-state.js';

export function createOnlineFeatureRouter() {
  const router = express.Router();

  router.get('/presence', auth, (_request, response) => {
    response.json({ onlineUserIds: getPublicOnlineIds() });
  });

  router.get('/admin/online-users', auth, route(async (request, response) => {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Admin only' });
    }

    const ids = getAllOnlineIds();
    if (!ids.length) return response.json({ users: [], total: 0 });

    const list = await db.select().from(users).where(inArray(users.id, ids));
    return response.json({
      total: list.length,
      users: list.map((user) => ({
        ...publicUser(user),
        isOnline: true,
        connections: getOnlineEntry(user.id)?.count || 0,
      })),
    });
  }));

  return router;
}
