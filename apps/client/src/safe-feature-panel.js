import { apiOrigin } from './runtime';

let activeChatId = null;
let installedFetchPatch = false;
let panel = null;

function token() {
  return localStorage.getItem('verdant-token');
}

function api(path, options = {}) {
  const headers = options.body instanceof FormData
    ? { Authorization: `Bearer ${token()}`, ...(options.headers || {}) }
    : { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...(options.headers || {}) };

  return fetch(`${apiOrigin}${path}`, { ...options, headers }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || 'Request failed.');
    return body;
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function installFetchPatch() {
  if (installedFetchPatch) return;
  installedFetchPatch = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const raw = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const match = String(raw).match(/\/api\/(?:v2\/)?chats\/(\d+)\//);
    if (match) activeChatId = Number(match[1]);
    return originalFetch(...args);
  };
}

function toast(text) {
  let node = document.querySelector('.safe-feature-toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'safe-feature-toast';
    document.body.appendChild(node);
  }
  node.textContent = text;
  node.classList.add('show');
  window.clearTimeout(node._timer);
  node._timer = window.setTimeout(() => node.classList.remove('show'), 2200);
}

function closePanel() {
  panel?.remove();
  panel = null;
}

function ensurePanel(title) {
  closePanel();
  panel = document.createElement('section');
  panel.className = 'safe-feature-panel chat-info-panel';
  panel.innerHTML = `<header><b>${escapeHtml(title)}</b><button type="button" aria-label="Close">×</button></header><div class="safe-feature-body"></div>`;
  panel.querySelector('header button').addEventListener('click', closePanel);
  document.body.appendChild(panel);
  return panel.querySelector('.safe-feature-body');
}

function chatIdOrError() {
  if (!activeChatId) throw new Error('Open a chat first.');
  return activeChatId;
}

async function openChatInfo() {
  const body = ensurePanel('Chat info');
  body.innerHTML = '<p>Loading…</p>';
  try {
    const data = await api(`/api/v2/chats/${chatIdOrError()}/info`);
    body.innerHTML = `
      <div class="safe-feature-card"><b>${escapeHtml(data.chat.title || `${data.chat.type} chat`)}</b><small>${escapeHtml(data.chat.description || data.chat.type)}</small></div>
      ${data.pinnedMessage ? `<div class="safe-feature-card"><b>Pinned message</b><small>${escapeHtml(data.pinnedMessage.body || data.pinnedMessage.fileName || 'Pinned message')}</small></div>` : ''}
      <div class="safe-feature-card"><b>Members</b>${(data.members || []).map((member) => `<small>${escapeHtml(member.display_name || member.username)} · ${escapeHtml(member.role)}</small>`).join('')}</div>
      <button class="safe-feature-primary" data-invite>Create invite link</button>
    `;
    body.querySelector('[data-invite]')?.addEventListener('click', async () => {
      const invite = await api(`/api/v2/chats/${data.chat.id}/invites`, { method: 'POST' });
      await navigator.clipboard?.writeText(`${location.origin}${invite.invite.url}`);
      toast('Invite link copied');
    });
  } catch (error) {
    body.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function attachChatInfoTarget() {
  const title = document.querySelector('.conversation-head .conversation-title');
  const avatar = document.querySelector('.conversation-head .head-avatar');
  if (!title || title.dataset.chatInfoReady) return;
  title.dataset.chatInfoReady = 'true';
  title.setAttribute('role', 'button');
  title.setAttribute('tabindex', '0');
  title.addEventListener('click', openChatInfo);
  title.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openChatInfo();
    }
  });
  if (avatar && !avatar.dataset.chatInfoReady) {
    avatar.dataset.chatInfoReady = 'true';
    avatar.style.cursor = 'pointer';
    avatar.addEventListener('click', openChatInfo);
  }
}

installFetchPatch();
const observer = new MutationObserver(attachChatInfoTarget);
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', attachChatInfoTarget);
window.addEventListener('focus', attachChatInfoTarget);
attachChatInfoTarget();
