import { Server } from 'socket.io';
import { attachFeaturePresence } from './feature-state.js';

let ioInstance = null;
let presenceAttached = false;
const originalUse = Server.prototype.use;

Server.prototype.use = function captureFeatureIo(...args) {
  ioInstance = this;
  if (!presenceAttached) {
    presenceAttached = true;
    attachFeaturePresence(this);
  }
  return originalUse.apply(this, args);
};

export function getFeatureIo() {
  return ioInstance;
}
