import express from 'express';
import { createChatFeatureRouter } from './feature-chats.js';
import { createOnlineFeatureRouter } from './feature-online.js';
import { createAvatarFeatureRouter } from './feature-avatar.js';
import { createInteractionRouter } from './feature-interactions.js';
import { createMessagePageRouter } from './feature-message-pages.js';
import { createRssProxyRouter } from './feature-rss-proxy.js';
import { createFeaturePackRouter } from './feature-pack.js';
import { createMediaFeatureRouter } from './feature-media.js';
import { createRetentionRouter } from './feature-retention.js';

export function createFeatureRouter({ io }) {
  const router = express.Router();
  router.use(createRetentionRouter());
  router.use(createRssProxyRouter());
  router.use(createFeaturePackRouter());
  router.use(createMessagePageRouter());
  router.use(createMediaFeatureRouter());
  router.use(createInteractionRouter());
  router.use(createChatFeatureRouter({ io }));
  router.use(createOnlineFeatureRouter());
  router.use(createAvatarFeatureRouter());
  return router;
}
