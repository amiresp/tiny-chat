import './telegram-desktop.css';
import './telegram-desktop-polish.css';

let latestChats = [];
const originalFetch = window.fetch.bind(window);

function formatChatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diff = now.getTime() - date.getTime();
  if (diff < 7 * 24 * 60 * 60 * 1000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
}

function chatPreview(chat) {
  const body = String(chat.lastMessageBody || '').trim();
  if (body) return body.replace(/\s+/g, ' ').slice(0, 78);
  if (chat.lastMessageFileName) return `📎 ${chat.lastMessageFileName}`;
  if (chat.lastMessageType === 'voice') return '🎤 Voice message';
  if (chat.lastMessageType === 'image') return '🖼 Photo';
  if (chat.lastMessageType === 'video') return '🎬 Video';
  if (chat.type === 'saved') return 'Saved messages';
  if (chat.type === 'rss') return 'RSS channel';
  if (chat.type === 'group') return 'Group conversation';
  return chat.peer?.isOnline ? 'online' : 'direct message';
}

function decorateChatRows() {
  if (!latestChats.length) return;
  const rows = [...document.querySelectorAll('.chat-row')];
  for (const row of rows) {
    const title = row.querySelector('h2')?.textContent?.trim();
    const chat = latestChats.find((item) => String(item.title || '').trim() === title);
    if (!chat) continue;
    const label = row.querySelector('ion-label');
    if (!(label instanceof HTMLElement)) continue;
    label.dataset.preview = chatPreview(chat);
    label.dataset.time = formatChatTime(chat.lastMessageAt || chat.updatedAt);
    label.dataset.own = Number(chat.lastMessageSenderId) > 0 ? '1' : '0';
    row.dataset.chatId = String(chat.id);
    row.classList.toggle('is-muted', Boolean(chat.muted));
    row.classList.toggle('has-unread', Number(chat.unreadCount || 0) > 0);
  }
}

window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  const raw = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  const method = String(args[1]?.method || args[0]?.method || 'GET').toUpperCase();
  if (/\/api\/v2\/chats(?:\?|$)/.test(String(raw)) && method === 'GET') {
    response.clone().json().then((data) => {
      latestChats = Array.isArray(data?.chats) ? data.chats : [];
      requestAnimationFrame(decorateChatRows);
      setTimeout(decorateChatRows, 250);
    }).catch(() => {});
  }
  return response;
};

const rowsObserver = new MutationObserver(() => requestAnimationFrame(decorateChatRows));
rowsObserver.observe(document.documentElement, { childList: true, subtree: true });

function clickSegment(value) {
  const buttons = [...document.querySelectorAll('.chat-list-page ion-segment-button')];
  const target = buttons.find((button) => button.getAttribute('value') === value || button.textContent?.trim().toLowerCase() === value);
  target?.click();
}

function clickChat(title) {
  const row = [...document.querySelectorAll('.chat-row')].find((item) => item.querySelector('h2')?.textContent?.trim() === title);
  row?.click();
}

function openSettings() {
  const buttons = [...document.querySelectorAll('.chat-list-page ion-header ion-toolbar:first-of-type ion-buttons ion-button')];
  buttons[0]?.click();
}

function ensureTelegramRail() {
  const root = document.documentElement;
  if (!root.classList.contains('is-desktop') && !root.classList.contains('is-electron')) return;
  if (document.querySelector('.telegram-main-rail')) return;
  const rail = document.createElement('aside');
  rail.className = 'telegram-main-rail';
  rail.innerHTML = `
    <button type="button" class="telegram-rail-menu" title="Menu"><span>☰</span></button>
    <button type="button" data-action="all" class="active" title="All chats"><span>💬</span><small>All chats</small></button>
    <button type="button" data-action="saved" title="Saved Messages"><span>🔖</span><small>Saved</small></button>
    <button type="button" data-action="archived" title="Archived chats"><span>📁</span><small>Archived</small></button>
    <div class="telegram-rail-spacer"></div>
    <button type="button" data-action="settings" title="Settings"><span>⚙</span><small>Settings</small></button>
  `;
  rail.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    rail.querySelectorAll('button[data-action]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    if (button.dataset.action === 'all') clickSegment('active');
    if (button.dataset.action === 'archived') clickSegment('archived');
    if (button.dataset.action === 'saved') clickChat('Saved Messages');
    if (button.dataset.action === 'settings') openSettings();
  });
  document.body.appendChild(rail);
}

setTimeout(ensureTelegramRail, 500);
window.addEventListener('resize', () => setTimeout(ensureTelegramRail, 80), { passive: true });
