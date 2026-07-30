export function initials(entity) {
  return String(entity?.displayName || entity?.title || entity?.username || 'V')
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

export function titleOf(entity) {
  return entity?.displayName || entity?.title || entity?.username || 'Tiny Chat';
}

export function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export function snippet(message) {
  return message?.body || message?.fileName || message?.title || 'Attachment';
}

export function isAdmin(user) {
  return ['admin', 'administrator', 'superadmin', 'owner'].includes(
    String(user?.role || '').toLowerCase(),
  );
}

export function mergeMessages(current, incoming) {
  const byKey = new Map();
  for (const message of [...current, ...incoming]) {
    const key = message.id ? `id:${message.id}` : `client:${message.clientId}`;
    byKey.set(key, { ...(byKey.get(key) || {}), ...message });
  }
  return [...byKey.values()].sort((a, b) => {
    const left = new Date(a.createdAt || 0).getTime();
    const right = new Date(b.createdAt || 0).getTime();
    return left - right;
  });
}

export function mergeChats(visible, hidden = []) {
  const byId = new Map();
  for (const chat of [...visible, ...hidden]) byId.set(Number(chat.id), chat);
  return [...byId.values()].sort((a, b) => {
    const pinOrder = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinOrder) return pinOrder;
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });
}
