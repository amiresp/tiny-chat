import { api } from './api';

const SHOW_KEY = 'tiny-chat-show-hidden-chats';
const nativeFetch = window.fetch.bind(window);
let chatCache = [];

function isRevealMode() {
  return sessionStorage.getItem(SHOW_KEY) === '1';
}

function requestUrl(input) {
  try {
    const raw = typeof input === 'string' ? input : input?.url;
    return raw ? new URL(raw, location.origin) : null;
  } catch {
    return null;
  }
}

function requestMethod(input, init) {
  return String(init?.method || input?.method || 'GET').toUpperCase();
}

function isChatListRequest(input, init) {
  const url = requestUrl(input);
  return requestMethod(input, init) === 'GET' && url?.pathname === '/api/v2/chats';
}

function dateValue(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function mergeChats(visible, hidden) {
  const byId = new Map();
  for (const chat of [...visible, ...hidden]) byId.set(Number(chat.id), chat);
  return [...byId.values()].sort((a, b) => {
    const pinned = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinned) return pinned;
    return dateValue(b.updatedAt) - dateValue(a.updatedAt);
  });
}

function publishChats(chats) {
  chatCache = Array.isArray(chats) ? chats : [];
  window.__tinyChatChatCache = chatCache;
  document.dispatchEvent(new CustomEvent('tiny-chat:chats-loaded', {
    detail: { chats: chatCache, showHidden: isRevealMode() },
  }));
}

function jsonResponseLike(response, data) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

window.fetch = async (input, init) => {
  const response = await nativeFetch(input, init);
  if (!isChatListRequest(input, init) || !response.ok) return response;

  let visibleData;
  try {
    visibleData = await response.clone().json();
  } catch {
    return response;
  }

  if (!isRevealMode()) {
    publishChats(visibleData.chats || []);
    return response;
  }

  try {
    const hiddenData = await api('/api/v2/chats/hidden');
    const chats = mergeChats(visibleData.chats || [], hiddenData.chats || []);
    publishChats(chats);
    return jsonResponseLike(response, { ...visibleData, chats });
  } catch {
    publishChats(visibleData.chats || []);
    return response;
  }
};

function chatById(id) {
  return chatCache.find((chat) => Number(chat.id) === Number(id));
}

function activeChat() {
  const activeRow = document.querySelector('.chat-list .chat-row.active');
  const rowId = Number(activeRow?.dataset.chatId || 0);
  if (rowId) return chatById(rowId);

  const queryId = Number(new URLSearchParams(location.search).get('chat') || 0);
  if (queryId) return chatById(queryId);

  const title = document.querySelector('.room-title b')?.textContent?.trim();
  if (!title) return null;
  return chatCache.find((chat) => String(chat.title || '').trim() === title) || null;
}

function hiddenIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A11.4 11.4 0 0 1 12 4c5.5 0 9.5 5 9.5 5a16.4 16.4 0 0 1-3.1 3.5M6.2 6.2C3.9 7.7 2.5 9 2.5 9S6.5 14 12 14c1 0 1.9-.2 2.8-.5"/></svg>';
}

function updateControl(button, chat) {
  if (!button || !chat) return;
  button.dataset.chatId = String(chat.id);
  button.dataset.hidden = chat.hidden ? '1' : '0';
  button.innerHTML = `${hiddenIcon()}<span>${chat.hidden ? 'Unhide chat' : 'Hide chat'}</span>`;
  button.setAttribute('title', chat.hidden ? 'Return this chat to the normal list' : 'Hide this chat from the normal list');
}

async function toggleChat(button) {
  const chat = chatById(Number(button.dataset.chatId));
  if (!chat || chat.type === 'saved' || button.disabled) return;
  button.disabled = true;
  try {
    await api(`/api/v2/chats/${chat.id}/hidden`, {
      method: 'PATCH',
      body: JSON.stringify({ hidden: !chat.hidden }),
    });
    sessionStorage.setItem('tiny-chat-hidden-change', chat.hidden ? 'unhidden' : 'hidden');
    location.reload();
  } catch (error) {
    button.disabled = false;
    console.error('[TinyChat] hide chat failed', error);
  }
}

function createControl(host, chat) {
  const ionic = host.classList.contains('info-actions');
  const button = document.createElement(ionic ? 'ion-button' : 'button');
  button.className = 'tiny-hide-chat-action';
  if (ionic) {
    button.setAttribute('fill', 'outline');
    button.setAttribute('color', 'medium');
  } else {
    button.type = 'button';
  }
  updateControl(button, chat);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleChat(button);
  });
  host.appendChild(button);
}

function ensureHideControls() {
  const chat = activeChat();
  if (!chat || chat.type === 'saved') return;

  for (const host of document.querySelectorAll('.info-actions, .tiny-profile-actions')) {
    let button = host.querySelector('.tiny-hide-chat-action');
    if (!button) {
      createControl(host, chat);
      button = host.querySelector('.tiny-hide-chat-action');
    }
    updateControl(button, chat);
  }
}

function decorateHiddenRows() {
  const show = isRevealMode();
  document.documentElement.classList.toggle('tiny-show-hidden-chats', show);

  for (const row of document.querySelectorAll('.chat-list .chat-row')) {
    const id = Number(row.dataset.chatId || 0);
    const title = row.querySelector('h2')?.textContent?.trim();
    const chat = (id && chatById(id))
      || chatCache.find((item) => String(item.title || '').trim() === title);
    const hidden = Boolean(chat?.hidden);
    row.classList.toggle('tiny-hidden-chat', hidden);
    if (hidden) row.setAttribute('title', 'Hidden chat');
    else if (row.getAttribute('title') === 'Hidden chat') row.removeAttribute('title');
  }
}

function refreshDecorations() {
  requestAnimationFrame(() => {
    decorateHiddenRows();
    ensureHideControls();
  });
  window.setTimeout(() => {
    decorateHiddenRows();
    ensureHideControls();
  }, 140);
}

document.addEventListener('tiny-chat:chats-loaded', refreshDecorations);

document.addEventListener('click', (event) => {
  const title = event.target.closest?.('.tiny-title-brand, .chat-list-page ion-title');
  if (title && event.detail >= 3) {
    event.preventDefault();
    event.stopPropagation();
    sessionStorage.setItem(SHOW_KEY, isRevealMode() ? '0' : '1');
    location.reload();
    return;
  }

  if (event.target.closest?.('.room-title, .chat-room-page ion-header ion-buttons[slot="end"]')) {
    window.setTimeout(ensureHideControls, 100);
    window.setTimeout(ensureHideControls, 320);
  }
}, true);

window.addEventListener('popstate', () => window.setTimeout(ensureHideControls, 120));
window.addEventListener('DOMContentLoaded', refreshDecorations);
document.documentElement.classList.toggle('tiny-show-hidden-chats', isRevealMode());
