import { Server } from 'socket.io';

let ioInstance = null;
const originalUse = Server.prototype.use;

Server.prototype.use = function captureFeatureIo(...args) {
  ioInstance = this;
  return originalUse.apply(this, args);
};

export function getFeatureIo() {
  return ioInstance;
}
