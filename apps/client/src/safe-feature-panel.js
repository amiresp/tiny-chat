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
  panel.className = 'safe-feature-panel';
  panel.innerHTML = `<header><b>${escapeHtml(title)}</b><button type="button" aria-label="Close">×</button></header><div class="safe-feature-body"></div>`;
  panel.querySelector('header button').addEventListener('click', closePanel);
  document.body.appendChild(panel);
  return panel.querySelector('.safe-feature-body');
}

function chatIdOrError() {
  if (!activeChatId) throw new Error('Open a normal chat first.');
  return activeChatId;
}

async function openSearch() {
  const body = ensurePanel('Search messages');
  body.innerHTML = `<input class="safe-feature-input" placeholder="Search in this chat…" autofocus><div class="safe-feature-results"></div>`;
  const input = body.querySelector('input');
  const results = body.querySelector('.safe-feature-results');
  let timer;
  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const q = input.value.trim();
      if (!q) return results.replaceChildren();
      try {
        const data = await api(`/api/v2/chats/${chatIdOrError()}/search?q=${encodeURIComponent(q)}`);
        results.innerHTML = data.messages?.length
          ? data.messages.map((message) => `<article><b>${escapeHtml(message.body || message.fileName || 'Message')}</b><small>${escapeHtml(new Date(message.createdAt).toLocaleString())}</small></article>`).join('')
          : '<p>No results.</p>';
      } catch (error) {
        results.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
      }
    }, 250);
  });
  window.setTimeout(() => input.focus(), 40);
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
      <button class="safe-feature-secondary" data-saved>Saved items</button>
      <button class="safe-feature-secondary" data-sessions>Sessions</button>
      <button class="safe-feature-secondary" data-privacy>Privacy</button>
    `;
    body.querySelector('[data-invite]')?.addEventListener('click', async () => {
      const invite = await api(`/api/v2/chats/${data.chat.id}/invites`, { method: 'POST' });
      await navigator.clipboard?.writeText(`${location.origin}${invite.invite.url}`);
      toast('Invite link copied');
    });
    body.querySelector('[data-saved]')?.addEventListener('click', openSavedItems);
    body.querySelector('[data-sessions]')?.addEventListener('click', openSessions);
    body.querySelector('[data-privacy]')?.addEventListener('click', openPrivacy);
  } catch (error) {
    body.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function openSavedItems() {
  const body = ensurePanel('Saved items');
  body.innerHTML = '<p>Loading…</p>';
  try {
    const data = await api('/api/v2/saved-items');
    body.innerHTML = data.items?.length
      ? data.items.map((item) => `<article class="safe-feature-card"><b>${escapeHtml(item.title || item.source_type)}</b><small>${escapeHtml(item.url || item.source_id)}</small><button data-id="${item.id}">Remove</button></article>`).join('')
      : '<p>No saved items.</p>';
    body.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', async () => {
      await api(`/api/v2/saved-items/${button.dataset.id}`, { method: 'DELETE' });
      button.closest('article')?.remove();
    }));
  } catch (error) {
    body.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function openSessions() {
  const body = ensurePanel('Sessions');
  body.innerHTML = '<p>Loading…</p>';
  try {
    const data = await api('/api/v2/sessions');
    body.innerHTML = data.sessions?.length
      ? data.sessions.map((session) => `<article class="safe-feature-card"><b>${escapeHtml(session.id.slice(0, 10))}</b><small>Last used: ${escapeHtml(new Date(session.last_used_at).toLocaleString())}</small><button data-id="${escapeHtml(session.id)}">Logout</button></article>`).join('')
      : '<p>No sessions.</p>';
    body.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', async () => {
      await api(`/api/v2/sessions/${button.dataset.id}`, { method: 'DELETE' });
      button.closest('article')?.remove();
    }));
  } catch (error) {
    body.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function openPrivacy() {
  const body = ensurePanel('Privacy');
  body.innerHTML = '<p>Loading…</p>';
  try {
    const data = await api('/api/v2/privacy');
    body.innerHTML = `
      <form class="safe-feature-form">
        <label><input name="readReceipts" type="checkbox" ${data.privacy.read_receipts ? 'checked' : ''}> Read receipts</label>
        <label>Last seen<select name="lastSeen"><option value="everyone">Everyone</option><option value="nobody">Nobody</option></select></label>
        <label>Messages<select name="allowMessages"><option value="everyone">Everyone</option><option value="contacts">Contacts</option></select></label>
        <button class="safe-feature-primary">Save privacy</button>
      </form>
      <div class="safe-feature-card"><b>Blocked users</b>${data.blocked?.map((user) => `<small>${escapeHtml(user.display_name || user.username)}</small>`).join('') || '<small>No blocked users.</small>'}</div>
    `;
    body.querySelector('[name="lastSeen"]').value = data.privacy.last_seen || 'everyone';
    body.querySelector('[name="allowMessages"]').value = data.privacy.allow_messages || 'everyone';
    body.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await api('/api/v2/privacy', { method: 'PATCH', body: JSON.stringify({ readReceipts: Boolean(form.get('readReceipts')), lastSeen: form.get('lastSeen'), allowMessages: form.get('allowMessages') }) });
      toast('Privacy saved');
    });
  } catch (error) {
    body.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function attachToolsButton() {
  const headActions = document.querySelector('.conversation-head .head-actions');
  if (!headActions || headActions.querySelector('.safe-feature-tools')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'safe-feature-tools';
  button.title = 'Chat tools';
  button.textContent = 'Tools';
  button.addEventListener('click', () => {
    const body = ensurePanel('Chat tools');
    body.innerHTML = `
      <button class="safe-feature-row" data-tool="search">Search messages</button>
      <button class="safe-feature-row" data-tool="info">Chat info</button>
      <button class="safe-feature-row" data-tool="saved">Saved items</button>
      <button class="safe-feature-row" data-tool="sessions">Sessions</button>
      <button class="safe-feature-row" data-tool="privacy">Privacy</button>
    `;
    body.querySelector('[data-tool="search"]').addEventListener('click', openSearch);
    body.querySelector('[data-tool="info"]').addEventListener('click', openChatInfo);
    body.querySelector('[data-tool="saved"]').addEventListener('click', openSavedItems);
    body.querySelector('[data-tool="sessions"]').addEventListener('click', openSessions);
    body.querySelector('[data-tool="privacy"]').addEventListener('click', openPrivacy);
  });
  headActions.prepend(button);
}

installFetchPatch();
const observer = new MutationObserver(attachToolsButton);
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', attachToolsButton);
window.addEventListener('focus', attachToolsButton);
attachToolsButton();
