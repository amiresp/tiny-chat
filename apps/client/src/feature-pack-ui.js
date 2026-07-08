import { apiOrigin } from './runtime';

const token = () => localStorage.getItem('verdant-token');
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
let longPressTimer = null;
let activeChatId = null;
let typingTimer = null;
let draftTimer = null;

function api(path, options = {}) {
  return fetch(`${apiOrigin}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || 'Request failed.');
    return body;
  });
}

function chatIdFromDom() {
  const selected = document.querySelector('.chat.active, .chat.selected, .chat[aria-current="true"]');
  const id = selected?.dataset?.chatId || document.querySelector('.conversation')?.dataset?.chatId;
  if (id) return Number(id);
  const title = document.querySelector('.conversation-title b, .conversation-title strong')?.textContent?.trim();
  const chat = [...document.querySelectorAll('.chat')].find((item) => item.textContent.includes(title));
  return Number(chat?.dataset?.chatId || 0) || activeChatId;
}

function detectActiveChat() {
  const chatButtons = [...document.querySelectorAll('.chat')];
  chatButtons.forEach((button) => {
    if (button.dataset.featurePackReady) return;
    button.dataset.featurePackReady = 'true';
    button.addEventListener('click', () => {
      const id = button.dataset.chatId || button.getAttribute('data-id');
      if (id) activeChatId = Number(id);
      window.setTimeout(attachChatTools, 120);
    });
  });
}

function toast(text) {
  let node = document.querySelector('.feature-toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'feature-toast';
    document.body.appendChild(node);
  }
  node.textContent = text;
  node.classList.add('show');
  window.clearTimeout(node._timer);
  node._timer = window.setTimeout(() => node.classList.remove('show'), 2200);
}

function closeMenus() {
  document.querySelectorAll('.message-context-menu,.chat-info-sheet,.feature-search-panel,.feature-privacy-page,.feature-sessions-page').forEach((node) => node.remove());
}

function messageIdFromNode(node) {
  return node.closest('[data-message-id]')?.dataset?.messageId || node.closest('[data-message-id]')?.getAttribute('data-message-id');
}

function openMessageMenu(target) {
  const item = target.closest('[data-message-id]');
  const messageId = messageIdFromNode(target);
  if (!item || !messageId) return;
  closeMenus();
  const rect = item.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'message-context-menu';
  menu.innerHTML = `
    <button data-action="copy">Copy</button>
    <button data-action="reply">Reply</button>
    <button data-action="forward">Forward</button>
    <button data-action="pin">Pin message</button>
    <button data-action="save">Read later</button>
  `;
  menu.style.left = `${Math.min(window.innerWidth - 190, Math.max(10, rect.left + 10))}px`;
  menu.style.top = `${Math.min(window.innerHeight - 230, Math.max(10, rect.top + 20))}px`;
  menu.addEventListener('click', async (event) => {
    const action = event.target.closest('button')?.dataset?.action;
    if (!action) return;
    const text = item.innerText.trim();
    try {
      if (action === 'copy') await navigator.clipboard?.writeText(text);
      if (action === 'reply') item.querySelector('.bubble')?.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
      if (action === 'pin') await api(`/api/v2/messages/${messageId}/pin`, { method: 'POST' });
      if (action === 'save') await api('/api/v2/saved-items', { method: 'POST', body: JSON.stringify({ sourceType: 'message', sourceId: messageId, title: text.slice(0, 80), meta: { chatId: chatIdFromDom() } }) });
      if (action === 'forward') openForwardSheet(messageId);
      toast(action === 'copy' ? 'Copied' : 'Done');
    } catch (error) {
      toast(error.message);
    } finally {
      if (action !== 'forward') menu.remove();
    }
  });
  document.body.appendChild(menu);
}

function attachLongPress() {
  document.querySelectorAll('[data-message-id]').forEach((item) => {
    if (item.dataset.longPressReady) return;
    item.dataset.longPressReady = 'true';
    item.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      longPressTimer = window.setTimeout(() => openMessageMenu(item), 520);
    });
    item.addEventListener('pointerup', () => window.clearTimeout(longPressTimer));
    item.addEventListener('pointermove', () => window.clearTimeout(longPressTimer));
    item.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openMessageMenu(item);
    });
  });
}

function openForwardSheet(messageId) {
  closeMenus();
  const sheet = document.createElement('div');
  sheet.className = 'chat-info-sheet';
  sheet.innerHTML = `<header><b>Forward to…</b><button>×</button></header><div class="feature-sheet-list"></div>`;
  sheet.querySelector('button').onclick = () => sheet.remove();
  const list = sheet.querySelector('.feature-sheet-list');
  document.querySelectorAll('.chat').forEach((chat) => {
    const id = chat.dataset.chatId || chat.getAttribute('data-id');
    const button = document.createElement('button');
    button.innerHTML = `<span>${chat.innerText.trim().split('\n')[0] || 'Chat'}</span><em>›</em>`;
    button.onclick = async () => {
      await api(`/api/v2/messages/${messageId}/forward`, { method: 'POST', body: JSON.stringify({ chatId: Number(id || activeChatId) }) });
      sheet.remove();
      toast('Forwarded');
    };
    list.appendChild(button);
  });
  document.body.appendChild(sheet);
}

function attachSearchButton() {
  const actions = document.querySelector('.conversation-actions');
  if (!actions || actions.dataset.searchReady) return;
  actions.dataset.searchReady = 'true';
  const button = document.createElement('button');
  button.className = 'feature-search-button';
  button.title = 'Search messages';
  button.textContent = '⌕';
  button.onclick = openSearchPanel;
  actions.prepend(button);
}

function openSearchPanel() {
  closeMenus();
  const panel = document.createElement('div');
  panel.className = 'feature-search-panel';
  panel.innerHTML = `<header><input placeholder="Search in this chat…" autofocus><button>×</button></header><div class="feature-search-results"></div>`;
  panel.querySelector('button').onclick = () => panel.remove();
  const input = panel.querySelector('input');
  const results = panel.querySelector('.feature-search-results');
  let timer;
  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const q = input.value.trim();
      if (!q) return results.replaceChildren();
      try {
        const data = await api(`/api/v2/chats/${chatIdFromDom()}/search?q=${encodeURIComponent(q)}`);
        results.innerHTML = data.messages.map((message) => `<button data-id="${message.id}"><b>${escapeHtml(message.body || message.fileName || 'Message')}</b><small>${new Date(message.createdAt).toLocaleString()}</small></button>`).join('') || '<p>No results</p>';
        results.querySelectorAll('button').forEach((button) => button.onclick = () => {
          document.querySelector(`[data-message-id="${button.dataset.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      } catch (error) {
        results.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
      }
    }, 260);
  });
  document.body.appendChild(panel);
  window.setTimeout(() => input.focus(), 60);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function attachDraftAndTyping() {
  const textarea = document.querySelector('.composer textarea');
  if (!textarea || textarea.dataset.featureDraftReady) return;
  textarea.dataset.featureDraftReady = 'true';
  const chatId = chatIdFromDom();
  const key = `verdant-draft-${chatId}`;
  textarea.value = localStorage.getItem(key) || textarea.value;
  textarea.addEventListener('input', () => {
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(() => localStorage.setItem(key, textarea.value), 150);
    window.clearTimeout(typingTimer);
    api(`/api/v2/chats/${chatId}/typing`, { method: 'POST', body: JSON.stringify({ typing: true }) }).catch(() => {});
    typingTimer = window.setTimeout(() => api(`/api/v2/chats/${chatId}/typing`, { method: 'POST', body: JSON.stringify({ typing: false }) }).catch(() => {}), 1600);
  });
  const form = textarea.closest('form') || textarea.parentElement;
  form?.addEventListener('submit', () => localStorage.removeItem(key));
}

function attachChatInfoButton() {
  const title = document.querySelector('.conversation-title');
  if (!title || title.dataset.infoReady) return;
  title.dataset.infoReady = 'true';
  title.style.cursor = 'pointer';
  title.addEventListener('click', openChatInfo);
}

async function openChatInfo() {
  closeMenus();
  const sheet = document.createElement('div');
  sheet.className = 'chat-info-sheet';
  sheet.innerHTML = `<header><b>Chat info</b><button>×</button></header><div class="feature-sheet-list"><p>Loading…</p></div>`;
  sheet.querySelector('button').onclick = () => sheet.remove();
  document.body.appendChild(sheet);
  const body = sheet.querySelector('.feature-sheet-list');
  try {
    const data = await api(`/api/v2/chats/${chatIdFromDom()}/info`);
    body.innerHTML = `
      <section><b>${escapeHtml(data.chat.title || `${data.chat.type} chat`)}</b><small>${escapeHtml(data.chat.description || data.chat.type)}</small></section>
      ${data.pinnedMessage ? `<section><b>Pinned</b><small>${escapeHtml(data.pinnedMessage.body || data.pinnedMessage.fileName || 'Pinned message')}</small></section>` : ''}
      <section><b>Members</b>${data.members.map((m) => `<small>${escapeHtml(m.display_name || m.username)} · ${escapeHtml(m.role)}</small>`).join('')}</section>
      <button data-invite>Create invite link</button>
      <button data-sessions>Sessions</button>
      <button data-privacy>Privacy & blocked users</button>
    `;
    body.querySelector('[data-invite]')?.addEventListener('click', async () => {
      const invite = await api(`/api/v2/chats/${data.chat.id}/invites`, { method: 'POST' });
      await navigator.clipboard?.writeText(`${location.origin}${invite.invite.url}`);
      toast('Invite link copied');
    });
    body.querySelector('[data-sessions]')?.addEventListener('click', openSessionsPage);
    body.querySelector('[data-privacy]')?.addEventListener('click', openPrivacyPage);
  } catch (error) {
    body.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function openSessionsPage() {
  closeMenus();
  const panel = document.createElement('div');
  panel.className = 'feature-sessions-page';
  panel.innerHTML = `<header><b>Sessions</b><button>×</button></header><div>Loading…</div>`;
  panel.querySelector('button').onclick = () => panel.remove();
  document.body.appendChild(panel);
  const body = panel.querySelector('div');
  const data = await api('/api/v2/sessions');
  body.innerHTML = data.sessions.map((s) => `<article><b>${escapeHtml(s.id.slice(0, 8))}</b><small>Last used: ${new Date(s.last_used_at).toLocaleString()}</small><button data-id="${s.id}">Logout</button></article>`).join('') || '<p>No sessions.</p>';
  body.querySelectorAll('button').forEach((button) => button.onclick = async () => { await api(`/api/v2/sessions/${button.dataset.id}`, { method: 'DELETE' }); button.closest('article').remove(); });
}

async function openPrivacyPage() {
  closeMenus();
  const panel = document.createElement('div');
  panel.className = 'feature-privacy-page';
  panel.innerHTML = `<header><b>Privacy</b><button>×</button></header><form><label><input name="readReceipts" type="checkbox"> Read receipts</label><label>Last seen<select name="lastSeen"><option value="everyone">Everyone</option><option value="nobody">Nobody</option></select></label><label>Messages<select name="allowMessages"><option value="everyone">Everyone</option><option value="contacts">Contacts</option></select></label><button>Save</button></form><div class="blocked-list"></div>`;
  panel.querySelector('header button').onclick = () => panel.remove();
  document.body.appendChild(panel);
  const data = await api('/api/v2/privacy');
  panel.querySelector('[name="readReceipts"]').checked = Boolean(data.privacy.read_receipts);
  panel.querySelector('[name="lastSeen"]').value = data.privacy.last_seen;
  panel.querySelector('[name="allowMessages"]').value = data.privacy.allow_messages;
  panel.querySelector('.blocked-list').innerHTML = data.blocked.map((u) => `<article><span>${escapeHtml(u.display_name || u.username)}</span><button data-id="${u.id}">Unblock</button></article>`).join('');
  panel.querySelector('form').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api('/api/v2/privacy', { method: 'PATCH', body: JSON.stringify({ readReceipts: Boolean(form.get('readReceipts')), lastSeen: form.get('lastSeen'), allowMessages: form.get('allowMessages') }) });
    toast('Privacy saved');
  };
  panel.querySelectorAll('.blocked-list button').forEach((button) => button.onclick = async () => { await api(`/api/v2/users/${button.dataset.id}/block`, { method: 'DELETE' }); button.closest('article').remove(); });
}

function attachRssReadLater() {
  document.querySelectorAll('.rss-card').forEach((card) => {
    if (card.dataset.readLaterReady) return;
    card.dataset.readLaterReady = 'true';
    const button = document.createElement('button');
    button.className = 'rss-read-later';
    button.textContent = 'Read later';
    button.onclick = async (event) => {
      event.stopPropagation();
      const url = card.querySelector('a')?.href || location.href;
      await api('/api/v2/saved-items', { method: 'POST', body: JSON.stringify({ sourceType: 'rss', sourceId: url, title: card.querySelector('h3')?.textContent || 'RSS item', url }) });
      toast('Saved');
    };
    card.querySelector('.rss-content')?.appendChild(button);
  });
}

function attachSwipeChatActions() {
  document.querySelectorAll('.chat').forEach((chat) => {
    if (chat.dataset.swipeActionsReady) return;
    chat.dataset.swipeActionsReady = 'true';
    let startX = 0;
    let active = false;
    chat.addEventListener('touchstart', (event) => { startX = event.touches[0].clientX; active = true; }, { passive: true });
    chat.addEventListener('touchmove', (event) => {
      if (!active) return;
      const dx = event.touches[0].clientX - startX;
      if (Math.abs(dx) > 18) chat.style.transform = `translateX(${Math.max(-72, Math.min(72, dx))}px)`;
    }, { passive: true });
    chat.addEventListener('touchend', () => {
      const dx = Number(chat.style.transform.match(/-?\d+/)?.[0] || 0);
      chat.style.transform = '';
      active = false;
      if (dx > 58) chat.querySelector('[title*="Pin"], [aria-label*="Pin"]')?.click();
      if (dx < -58) chat.querySelector('[title*="Archive"], [aria-label*="Archive"]')?.click();
    });
  });
}

function attachUploadProgress() {
  document.querySelectorAll('input[type="file"]').forEach((input) => {
    if (input.dataset.uploadProgressReady) return;
    input.dataset.uploadProgressReady = 'true';
    input.addEventListener('change', () => {
      if (!input.files?.length) return;
      let bar = document.querySelector('.upload-progress-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'upload-progress-bar';
        bar.innerHTML = '<span></span>';
        document.body.appendChild(bar);
      }
      bar.classList.add('show');
      bar.querySelector('span').style.width = '18%';
      window.setTimeout(() => bar.querySelector('span').style.width = '68%', 180);
      window.setTimeout(() => { bar.querySelector('span').style.width = '100%'; bar.classList.remove('show'); }, 1400);
    });
  });
}

function attachChatTools() {
  detectActiveChat();
  attachLongPress();
  attachSearchButton();
  attachDraftAndTyping();
  attachChatInfoButton();
  attachRssReadLater();
  attachSwipeChatActions();
  attachUploadProgress();
}

const observer = new MutationObserver(() => attachChatTools());
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('focus', attachChatTools);
document.addEventListener('DOMContentLoaded', attachChatTools);
attachChatTools();
