import { api, getToken } from './api';
import './tiny-chat-client-polish.css';

const DEFAULT_TITLE = 'Tiny Chat';
const DEFAULT_FAVICON = '/icon.svg';

let chats = Array.isArray(window.__tinyChatChatCache) ? window.__tinyChatChatCache : [];
let refreshTimer = null;
let pollingTimer = null;
let blinkTimer = null;
let cachedUnread = -1;
let faviconLink = document.querySelector('link[rel~="icon"]');
const faviconCache = new Map();

function ensureFavicon() {
  if (faviconLink) return faviconLink;
  faviconLink = document.createElement('link');
  faviconLink.rel = 'icon';
  document.head.appendChild(faviconLink);
  return faviconLink;
}

function unreadIcon(count, dimmed = false) {
  const key = `${count}:${dimmed ? 1 : 0}`;
  if (faviconCache.has(key)) return faviconCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return DEFAULT_FAVICON;

  ctx.fillStyle = dimmed ? '#64748b' : '#09b8d5';
  ctx.beginPath();
  ctx.arc(29, 31, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  for (const x of [21, 29, 37]) {
    ctx.beginPath();
    ctx.arc(x, 31, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const text = count > 99 ? '99+' : String(count);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(48, 16, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${text.length > 2 ? 12 : 15}px Vazirmatn, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 48, 16.5);

  const result = canvas.toDataURL('image/png');
  faviconCache.set(key, result);
  return result;
}

function stopBlink() {
  if (blinkTimer) window.clearInterval(blinkTimer);
  blinkTimer = null;
}

function renderUnread(count) {
  const normalized = Math.max(0, Number(count || 0));
  const link = ensureFavicon();
  cachedUnread = normalized;
  stopBlink();

  if (!normalized) {
    document.title = DEFAULT_TITLE;
    link.type = 'image/svg+xml';
    link.href = DEFAULT_FAVICON;
    return;
  }

  document.title = `(${normalized > 99 ? '99+' : normalized}) ${DEFAULT_TITLE}`;
  link.type = 'image/png';
  const normal = unreadIcon(normalized, false);
  const dimmed = unreadIcon(normalized, true);
  link.href = normal;

  if (document.hidden) {
    let dim = false;
    blinkTimer = window.setInterval(() => {
      dim = !dim;
      link.href = dim ? dimmed : normal;
    }, 700);
  }
}

function formatLastSeen(value) {
  if (!value) return 'offline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'offline';

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (date.toDateString() === now.toDateString()) return `last seen today at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
  return `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
}

function presenceText(chat) {
  if (!chat?.peer || chat.peer.hidePresence) return 'direct message';
  return chat.peer.isOnline ? 'online' : formatLastSeen(chat.peer.lastSeenAt);
}

function chatForRow(row) {
  const id = Number(row?.dataset.chatId || 0);
  if (id) {
    const byId = chats.find((chat) => Number(chat.id) === id);
    if (byId) return byId;
  }
  const title = row?.querySelector('h2')?.textContent?.trim();
  return chats.find((chat) => chat.type === 'direct' && String(chat.title || '').trim() === title) || null;
}

function applyPresence() {
  for (const row of document.querySelectorAll('.chat-list .chat-row')) {
    const chat = chatForRow(row);
    if (!chat || chat.type !== 'direct') continue;
    row.classList.toggle('is-online', Boolean(chat.peer?.isOnline && !chat.peer?.hidePresence));
    const subtitle = row.querySelector('ion-label p, p');
    if (subtitle && !chat.lastMessageBody && !chat.lastMessageFileName) {
      const value = presenceText(chat);
      if (subtitle.textContent !== value) subtitle.textContent = value;
    }
  }

  const roomTitle = document.querySelector('.room-title');
  const activeTitle = roomTitle?.querySelector('b')?.textContent?.trim();
  const active = chats.find((chat) => chat.type === 'direct' && String(chat.title || '').trim() === activeTitle);
  const subtitle = roomTitle?.querySelector('small');
  if (active && subtitle) {
    const value = presenceText(active);
    if (subtitle.textContent !== value) subtitle.textContent = value;
  }
}

function applyChats(nextChats) {
  chats = Array.isArray(nextChats) ? nextChats : [];
  renderUnread(chats.reduce((sum, chat) => sum + Number(chat.unreadCount || 0), 0));
  requestAnimationFrame(applyPresence);
  window.setTimeout(applyPresence, 120);
}

async function refreshChats() {
  if (!getToken()) {
    applyChats([]);
    return;
  }
  try {
    const data = await api('/api/v2/chats');
    applyChats(data.chats || []);
  } catch {
    // Keep the current client state while temporarily offline.
  }
}

function scheduleRefresh(delay = 80) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refreshChats, delay);
}

document.addEventListener('tiny-chat:chats-loaded', (event) => {
  applyChats(event.detail?.chats || []);
});

document.addEventListener('visibilitychange', () => {
  renderUnread(cachedUnread < 0 ? 0 : cachedUnread);
  if (!document.hidden) scheduleRefresh(50);
});

window.addEventListener('focus', () => scheduleRefresh(50));
window.addEventListener('online', () => scheduleRefresh(50));
window.addEventListener('verdant-auth-change', () => scheduleRefresh(50));

document.addEventListener('click', (event) => {
  if (event.target.closest?.('.chat-row,.room-title,.back-arrow')) {
    window.setTimeout(applyPresence, 100);
  }
}, true);

pollingTimer = window.setInterval(() => {
  if (!document.hidden) refreshChats();
}, 60_000);

window.addEventListener('beforeunload', () => {
  stopBlink();
  window.clearTimeout(refreshTimer);
  if (pollingTimer) window.clearInterval(pollingTimer);
});

if (chats.length) applyChats(chats);
else refreshChats();
