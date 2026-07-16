import express from 'express';
import { sqlite } from './db.js';
import { auth } from './auth.js';
import { route } from './feature-state.js';

sqlite.exec(`
CREATE TABLE IF NOT EXISTS user_contacts (
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE(owner_id, contact_id),
  CHECK(owner_id <> contact_id)
);
CREATE INDEX IF NOT EXISTS user_contacts_owner_idx
ON user_contacts(owner_id, created_at DESC);
`);

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    mobile: row.mobile,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isOnline: Boolean(row.is_online),
    added: Boolean(row.added),
    createdAt: row.contact_created_at || null,
  };
}

export function createContactsRouter() {
  const router = express.Router();

  router.get('/contacts', auth, route(async (request, response) => {
    const rows = sqlite.prepare(`
      SELECT
        u.id,
        u.username,
        u.mobile,
        u.display_name,
        u.avatar_url,
        u.is_online,
        1 AS added,
        uc.created_at AS contact_created_at
      FROM user_contacts uc
      JOIN users u ON u.id = uc.contact_id
      WHERE uc.owner_id = ?
      ORDER BY COALESCE(u.display_name, u.username) COLLATE NOCASE ASC
    `).all(request.user.id);

    return response.json({ contacts: rows.map(mapUser) });
  }));

  router.get('/contacts/search', auth, route(async (request, response) => {
    const query = String(request.query.q || '').trim().slice(0, 100);
    if (query.length < 2) return response.json({ users: [] });

    const like = `%${query}%`;
    const rows = sqlite.prepare(`
      SELECT
        u.id,
        u.username,
        u.mobile,
        u.display_name,
        u.avatar_url,
        u.is_online,
        CASE WHEN uc.contact_id IS NULL THEN 0 ELSE 1 END AS added,
        uc.created_at AS contact_created_at
      FROM users u
      LEFT JOIN user_contacts uc
        ON uc.owner_id = ? AND uc.contact_id = u.id
      WHERE u.id <> ?
        AND (
          u.username LIKE ? COLLATE NOCASE
          OR u.mobile LIKE ?
          OR u.display_name LIKE ? COLLATE NOCASE
        )
      ORDER BY
        CASE WHEN u.username = ? OR u.mobile = ? THEN 0 ELSE 1 END,
        COALESCE(u.display_name, u.username) COLLATE NOCASE ASC
      LIMIT 30
    `).all(
      request.user.id,
      request.user.id,
      like,
      like,
      like,
      query,
      query,
    );

    return response.json({ users: rows.map(mapUser) });
  }));

  router.post('/contacts', auth, route(async (request, response) => {
    const contactId = Number(request.body?.userId);
    if (!Number.isInteger(contactId) || contactId <= 0 || contactId === Number(request.user.id)) {
      return response.status(400).json({ error: 'Invalid contact.' });
    }

    const target = sqlite.prepare(`
      SELECT id, username, mobile, display_name, avatar_url, is_online
      FROM users
      WHERE id = ?
    `).get(contactId);
    if (!target) return response.status(404).json({ error: 'User not found.' });

    const createdAt = Date.now();
    sqlite.prepare(`
      INSERT INTO user_contacts (owner_id, contact_id, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(owner_id, contact_id) DO NOTHING
    `).run(request.user.id, contactId, createdAt);

    return response.status(201).json({
      contact: mapUser({ ...target, added: 1, contact_created_at: createdAt }),
    });
  }));

  router.delete('/contacts/:userId', auth, route(async (request, response) => {
    const contactId = Number(request.params.userId);
    sqlite.prepare(`
      DELETE FROM user_contacts
      WHERE owner_id = ? AND contact_id = ?
    `).run(request.user.id, contactId);
    return response.json({ ok: true });
  }));

  return router;
}
