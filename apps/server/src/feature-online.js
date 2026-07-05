import express from 'express';
import { inArray } from 'drizzle-orm';
import { db } from './db.js';
import { users } from './schema.js';
import { auth } from './auth.js';
import { publicUser, route } from './feature-state.js';
import {
  allHeartbeatIds,
  heartbeat,
  publicHeartbeatIds,
} from './heartbeat-state.js';

export function createOnlineFeatureRouter() {
  const router = express.Router();

  router.post('/presence/heartbeat', auth, (request, response) => {
    heartbeat(request.user);
    response.json({ onlineUserIds: publicHeartbeatIds() });
  });

  router.get('/presence', auth, (_request, response) => {
    response.json({ onlineUserIds: publicHeartbeatIds() });
  });

  router.get('/admin/online-users', auth, route(async (request, response) => {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Admin only' });
    }

    const ids = allHeartbeatIds();
    if (!ids.length) return response.json({ users: [], total: 0 });

    const list = await db.select().from(users).where(inArray(users.id, ids));
    return response.json({
      total: list.length,
      users: list.map((user) => ({
        ...publicUser(user),
        isOnline: true,
        connections: 1,
      })),
    });
  }));

  return router;
}
