import express from 'express';
import { createFeatureRouter } from './feature-router.js';

const flag = Symbol.for('verdant.features.mounted');
const originalGet = express.application.get;
const originalUse = express.application.use;

express.application.get = function mountFeatures(pathValue, ...handlers) {
  if (handlers.length && !this[flag]) {
    this[flag] = true;
    originalUse.call(this, '/api/v2', createFeatureRouter({ io: null }));
  }
  return originalGet.call(this, pathValue, ...handlers);
};
