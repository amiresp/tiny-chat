import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { eq } from 'drizzle-orm';
import { db } from './db.js';
import { users } from './schema.js';
import { auth } from './auth.js';
import { publicUser, route } from './feature-state.js';

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');
const avatarDir = path.join(uploadDir, 'avatars');
fs.mkdirSync(avatarDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: avatarDir,
    filename: (request, file, callback) => {
      const extension = path.extname(file.originalname || '').toLowerCase() || '.img';
      callback(null, `user-${request.user.id}-${crypto.randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    callback(null, String(file.mimetype || '').startsWith('image/'));
  },
});

function receiveAvatar(request, response, next) {
  avatarUpload.single('avatar')(request, response, (error) => {
    if (error) {
      response.status(400).json({ error: error.message || 'Upload failed' });
      return;
    }
    next();
  });
}

export function createAvatarFeatureRouter() {
  const router = express.Router();

  router.post('/me/avatar', auth, receiveAvatar, route(async (request, response) => {
    if (!request.file) {
      return response.status(400).json({ error: 'Choose a valid image up to 5 MB' });
    }

    const avatarUrl = `/uploads/avatars/${path.basename(request.file.path)}`;
    const [user] = await db.update(users)
      .set({ avatarUrl })
      .where(eq(users.id, request.user.id))
      .returning();

    return response.json({ user: publicUser(user), avatarUrl });
  }));

  return router;
}
