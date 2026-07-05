const heartbeats = new Map();
const ttl = 45000;

function activeEntries() {
  const cutoff = Date.now() - ttl;
  for (const [userId, item] of heartbeats) {
    if (item.time < cutoff) heartbeats.delete(userId);
  }
  return heartbeats;
}

export function heartbeat(user) {
  heartbeats.set(Number(user.id), {
    time: Date.now(),
    hidden: Boolean(user.hidePresence),
  });
}

export function isHeartbeatOnline(userId) {
  return activeEntries().has(Number(userId));
}

export function publicHeartbeatIds() {
  return [...activeEntries()]
    .filter(([, item]) => !item.hidden)
    .map(([userId]) => Number(userId));
}

export function allHeartbeatIds() {
  return [...activeEntries().keys()].map(Number);
}
