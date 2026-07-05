import express from 'express';
import { createChatFeatureRouter } from './feature-chats.js';
import { createOnlineFeatureRouter } from './feature-online.js';
import { createAvatarFeatureRouter } from './feature-avatar.js';

export function createFeatureRouter({ io }) {
  const router = express.Router();
  router.use(createChatFeatureRouter({ io }));
  router.use(createOnlineFeatureRouter());
  router.use(createAvatarFeatureRouter());
  return router;
}
