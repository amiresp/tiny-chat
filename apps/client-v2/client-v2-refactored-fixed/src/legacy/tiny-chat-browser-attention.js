import { io } from 'socket.io-client';
import { api, getToken } from './api';
import { socketOrigin } from './runtime';
import './tiny-chat-browser-attention.css';

const DEFAULT_TITLE = 'Tiny Chat';
const DEFAULT_FAVICON = '/icon.svg';

let chats = [];
let totalUnread = 0;
let socket = null;
let blinkTimer = null;
let blinkOn = false;
let refreshTimer = null;
let presenceFrame = null;
let faviconLink = document.querySelector('link[rel~="icon"]');

function ensureFavicon() {
  if (faviconLink) return faviconLink;
  faviconLink = document.createElement('link');
  faviconLink.rel = 'icon';
  document.head.appendChild(faviconLink);
  return faviconLink;
}

function makeUnreadIcon(count, dimmed = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return DEFAULT_FAVICON;

  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = dimmed ? '#94a3b8' : '#09b8d5';
  ctx.beginPath();
  ctx.arc(29, 31, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(21, 31, 3.4, 0, Math.PI * 2);
  ctx.arc(29, 31, 3.4, 0, Math.PI * 2);
  ctx.arc(37, 31, 3.4, 0, Math.PI * 2);
  ctx.fill();

  if (count > 0) {
    const text = count > 99 ? '99+' : String(count);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(48, 16, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${text.length > 2 ? 12 : 15}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 48, 16.5);
  }

  return canvas.toDataURL('image/png');
}

function stopBlink() {
  if (blinkTimer) window.clearInterval(blinkTimer);
  blinkTimer = null;
  blinkOn = false;
}

function renderAttention() {
  const link = ensureFavicon();
  document.title = totalUnread > 0 ? `(${totalUnread > 99 ? '99+' : totalUnread}) ${DEFAULT_TITLE}` : DEFAULT_TITLE;

  stopBlink();
  if (totalUnread <= 0) {
    link.type = 'image/svg+xml';
    link.href = DEFAULT_FAVICON;
    return;
  }

  const normal = makeUnreadIcon(totalUnread, false);
  const dimmed = makeUnreadIcon(totalUnread, true);
  link.type = 'image/png';
  link.href = normal;

  if (document.hidden) {
    blinkTimer = window.setInterval(() => {
      blinkOn = !blinkOn;
      link.href = blinkOn ? dimmed : normal;
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

function directStatus(chat) {
  if (!chat?.peer || chat.peer.hidePresence) return 'direct message';
  if (chat.peer.isOnline) return 'online';
  return formatLastSeen(chat.peer.lastSeenAt);
}

function setTextIfChanged(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function updatePresenceDom() {
  const directChats = chats.filter((chat) => chat.type === 'direct');
  const rows = [...document.querySelectorAll('.chat-row')];

  for (const row of rows) {
    const title = row.querySelector('h2')?.textContent?.trim();
    if (!title) continue;
    const chat = directChats.find((item) => String(item.title || '').trim() === title);
    if (!chat) continue;
    setTextIfChanged(row.querySelector('ion-label p, p'), directStatus(chat));
  }

  const roomTitle = document.querySelector('.room-title');
  const activeTitle = roomTitle?.querySelector('b')?.textContent?.trim();
  if (roomTitle && activeTitle) {
    const activeChat = directChats.find((item) => String(item.title || '').trim() === activeTitle);
    if (activeChat) setTextIfChanged(roomTitle.querySelector('small'), directStatus(activeChat));
  }
}

function schedulePresenceDomUpdate() {
  if (presenceFrame) return;
  presenceFrame = requestAnimationFrame(() => {
    presenceFrame = null;
    updatePresenceDom();
  });
}

async function refreshChats() {
  if (!getToken()) {
    chats = [];
    totalUnread = 0;
    renderAttention();
    return;
  }

  try {
    const data = await api('/api/v2/chats');
    chats = data.chats || [];
    totalUnread = chats.reduce((sum, chat) => sum + Number(chat.unreadCount || 0), 0);
    renderAttention();
    schedulePresenceDomUpdate();
  } catch {
    // Keep the existing UI state if the connection is temporarily unavailable.
  }
}

function scheduleRefresh(delay = 120) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refreshChats, delay);
}

function applyPresence(event) {
  if (!event?.userId) return;
  let changed = false;
  chats = chats.map((chat) => {
    if (chat.type !== 'direct' || Number(chat.peer?.id) !== Number(event.userId)) return chat;
    changed = true;
    return {
      ...chat,
      peer: {
        ...chat.peer,
        isOnline: event.status === 'online',
        lastSeenAt: event.status === 'offline' ? (event.lastSeenAt || chat.peer?.lastSeenAt) : chat.peer?.lastSeenAt,
      },
    };
  });
  if (changed) schedulePresenceDomUpdate();
}

function disconnectSocket() {
  socket?.close();
  socket = null;
}

function connectSocket() {
  disconnectSocket();
  const token = getToken();
  if (!token) return;

  socket = io(socketOrigin, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  socket.on('message:new', () => scheduleRefresh(80));
  socket.on('message:status', () => scheduleRefresh(120));
  socket.on('message:read', () => scheduleRefresh(120));
  socket.on('chat:new', () => scheduleRefresh(80));
  socket.on('presence', applyPresence);
  socket.on('connect', () => scheduleRefresh(50));
}

const observer = new MutationObserver(schedulePresenceDomUpdate);
observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener('visibilitychange', () => {
  renderAttention();
  if (!document.hidden) scheduleRefresh(50);
});

window.addEventListener('focus', () => scheduleRefresh(50));
window.addEventListener('online', () => {
  connectSocket();
  scheduleRefresh(50);
});
window.addEventListener('verdant-auth-change', () => {
  connectSocket();
  scheduleRefresh(50);
});

document.addEventListener('click', (event) => {
  if (event.target.closest('.chat-row, .back-arrow, .room-title')) scheduleRefresh(350);
}, true);

window.setInterval(() => {
  schedulePresenceDomUpdate();
  if (!document.hidden) scheduleRefresh(0);
}, 60_000);

connectSocket();
refreshChats();
