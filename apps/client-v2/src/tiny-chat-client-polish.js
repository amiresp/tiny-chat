import { api, getToken } from './api';
import './tiny-chat-client-polish.css';

const DEFAULT_TITLE = 'Tiny Chat';
const DEFAULT_FAVICON = '/icon.svg';

let chats = [];
let refreshTimer = null;
let pollingTimer = null;
let blinkTimer = null;
let listObserver = null;
let observedList = null;
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

function unreadFromDom() {
  const total = [...document.querySelectorAll('.chat-list .chat-row ion-badge')]
    .reduce((sum, badge) => sum + (Number.parseInt(badge.textContent || '0', 10) || 0), 0);
  if (total !== cachedUnread) renderUnread(total);
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

function chatByTitle(title) {
  const normalized = String(title || '').trim();
  return chats.find((chat) => chat.type === 'direct' && String(chat.title || '').trim() === normalized);
}

function applyPresence() {
  for (const row of document.querySelectorAll('.chat-list .chat-row')) {
    const chat = chatByTitle(row.querySelector('h2')?.textContent);
    if (!chat) continue;
    row.classList.toggle('is-online', Boolean(chat.peer?.isOnline && !chat.peer?.hidePresence));
    const subtitle = row.querySelector('ion-label p, p');
    const value = presenceText(chat);
    if (subtitle && subtitle.textContent !== value && !chat.lastMessageBody && !chat.lastMessageFileName) subtitle.textContent = value;
  }

  const roomTitle = document.querySelector('.room-title');
  const chat = chatByTitle(roomTitle?.querySelector('b')?.textContent);
  const subtitle = roomTitle?.querySelector('small');
  if (chat && subtitle) {
    const value = presenceText(chat);
    if (subtitle.textContent !== value) subtitle.textContent = value;
  }
}

function bindChatListObserver() {
  const list = document.querySelector('.chat-list');
  if (!list || list === observedList) return;
  listObserver?.disconnect();
  observedList = list;
  listObserver = new MutationObserver(() => {
    unreadFromDom();
    applyPresence();
  });
  listObserver.observe(list, { childList: true, subtree: true, characterData: true });
  unreadFromDom();
  applyPresence();
}

async function refreshChats() {
  if (!getToken()) {
    chats = [];
    renderUnread(0);
    return;
  }
  try {
    const data = await api('/api/v2/chats');
    chats = Array.isArray(data.chats) ? data.chats : [];
    renderUnread(chats.reduce((sum, chat) => sum + Number(chat.unreadCount || 0), 0));
    bindChatListObserver();
    applyPresence();
  } catch {
    // UI remains usable while temporarily offline.
  }
}

function scheduleRefresh(delay = 100) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refreshChats, delay);
}

function restartPolling() {
  if (pollingTimer) window.clearInterval(pollingTimer);
  pollingTimer = window.setInterval(() => {
    if (!document.hidden) refreshChats();
  }, 60_000);
}

document.addEventListener('visibilitychange', () => {
  renderUnread(cachedUnread < 0 ? 0 : cachedUnread);
  if (!document.hidden) scheduleRefresh(50);
});

window.addEventListener('focus', () => scheduleRefresh(50));
window.addEventListener('online', () => scheduleRefresh(50));
window.addEventListener('verdant-auth-change', () => scheduleRefresh(50));
window.addEventListener('resize', bindChatListObserver, { passive: true });

document.addEventListener('click', (event) => {
  if (event.target.closest('.chat-row,.room-title,.back-arrow')) {
    window.setTimeout(() => {
      bindChatListObserver();
      applyPresence();
      unreadFromDom();
    }, 120);
  }
}, true);

window.addEventListener('beforeunload', () => {
  listObserver?.disconnect();
  stopBlink();
  if (pollingTimer) window.clearInterval(pollingTimer);
});

bindChatListObserver();
refreshChats();
restartPolling();
