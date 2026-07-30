import './tiny-chat-premium.css';

const ICONS = {
  chats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.7-5.1A7 7 0 0 1 3 12V8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7Z"/></svg>',
  rss: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4V3Z"/></svg>',
  users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.25.36.45.7.6 1 .14.3.2.66.2 1.1v.1h.8v4h-.1a1.7 1.7 0 0 0-1.5.8Z"/></svg>',
  savedAvatar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h12v15l-6-4-6 4v-15Z"/></svg>',
  rssAvatar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14"/><circle cx="5" cy="19" r="1.4"/></svg>',
  groupAvatar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 20v-1.5a4 4 0 0 0-3-3.75M16.5 2.8a4 4 0 0 1 0 7.4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
};

let latestChats = [];
let activeFilter = 'all';
const originalFetch = window.fetch.bind(window);

function formatChatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (today.getTime() - date.getTime() < 7 * 86400000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function chatPreview(chat) {
  const body = String(chat.lastMessageBody || '').trim().replace(/\s+/g, ' ');
  if (body) return body.slice(0, 72);
  if (chat.lastMessageFileName) return `Attachment · ${chat.lastMessageFileName}`;
  if (chat.lastMessageType === 'voice') return 'Voice message';
  if (chat.lastMessageType === 'image') return 'Photo';
  if (chat.lastMessageType === 'video') return 'Video';
  if (chat.type === 'saved') return 'Private saved messages';
  if (chat.type === 'rss') return 'RSS channel';
  if (chat.type === 'group') return 'Group conversation';
  return chat.peer?.isOnline ? 'online' : 'Direct message';
}

window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  const raw = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  const method = String(args[1]?.method || args[0]?.method || 'GET').toUpperCase();
  if (/\/api\/v2\/chats(?:\?|$)/.test(String(raw)) && method === 'GET') {
    response.clone().json().then((data) => {
      latestChats = Array.isArray(data?.chats) ? data.chats : [];
      requestAnimationFrame(enhanceAll);
    }).catch(() => {});
  }
  return response;
};

function tinyLogoMarkup(compact = false) {
  return `<span class="tiny-brand-logo ${compact ? 'compact' : ''}"><span></span><span></span><span></span><i></i><b></b></span>`;
}

function findChatByRow(row) {
  const id = Number(row.dataset.chatId || 0);
  const title = row.querySelector('h2')?.textContent?.trim();
  return latestChats.find((chat) => Number(chat.id) === id) || latestChats.find((chat) => String(chat.title || '').trim() === title);
}

function decorateChatRows() {
  for (const row of document.querySelectorAll('.chat-row')) {
    const chat = findChatByRow(row);
    if (!chat) continue;
    row.dataset.chatId = String(chat.id);
    row.dataset.chatType = chat.type || 'direct';
    row.classList.toggle('is-online', Boolean(chat.peer?.isOnline));
    row.classList.toggle('is-pinned', Boolean(chat.pinned));
    row.classList.toggle('has-unread', Number(chat.unreadCount || 0) > 0);
    const label = row.querySelector('ion-label');
    if (!label) continue;
    label.dataset.preview = chatPreview(chat);
    label.dataset.time = formatChatTime(chat.lastMessageAt || chat.updatedAt);
    const paragraph = label.querySelector('p');
    if (paragraph) paragraph.textContent = chatPreview(chat);
  }
  applyFilter();
}

function applyFilter() {
  for (const row of document.querySelectorAll('.chat-row')) {
    const type = row.dataset.chatType || 'direct';
    const visible = activeFilter === 'all'
      || (activeFilter === 'private' && ['direct', 'saved'].includes(type))
      || (activeFilter === 'groups' && type === 'group')
      || (activeFilter === 'rss' && type === 'rss');
    row.closest('ion-item-sliding')?.classList.toggle('tiny-filter-hidden', !visible);
  }
}

function ensureChatFilters() {
  const toolbar = document.querySelector('.chat-list-page ion-header ion-toolbar:last-child');
  if (!toolbar || toolbar.querySelector('.tiny-chat-filters')) return;
  const filters = document.createElement('div');
  filters.className = 'tiny-chat-filters';
  filters.innerHTML = ['all', 'private', 'groups', 'rss'].map((value) => `<button type="button" data-filter="${value}" class="${value === activeFilter ? 'active' : ''}">${value === 'all' ? 'All' : value === 'private' ? 'Private' : value === 'groups' ? 'Groups' : 'RSS'}</button>`).join('');
  filters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    activeFilter = button.dataset.filter;
    filters.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
    applyFilter();
  });
  toolbar.appendChild(filters);
  toolbar.querySelector('ion-segment')?.classList.add('tiny-original-segment');
}

function headerButtons() {
  return [...document.querySelectorAll('.chat-list-page ion-header ion-toolbar:first-child ion-buttons ion-button')];
}

function openSettings() {
  const button = headerButtons()[0];
  if (!button) return false;
  button.click();
  return true;
}

function openNewChat() {
  const buttons = headerButtons();
  const button = buttons[buttons.length - 1];
  if (!button) return false;
  button.click();
  return true;
}

function openSaved() {
  [...document.querySelectorAll('.chat-row')].find((row) => /saved messages/i.test(row.textContent || ''))?.click();
}

function setRailActive(rail, action) {
  rail.querySelectorAll('button[data-action]').forEach((item) => item.classList.toggle('active', item.dataset.action === action));
}

function ensureDesktopRail() {
  const shell = document.querySelector('.desktop-shell');
  let rail = document.querySelector('.tiny-navigation-rail');
  if (window.innerWidth < 1024 || !shell) {
    rail?.remove();
    document.documentElement.classList.remove('tiny-has-desktop-rail');
    return;
  }
  if (!rail) {
    rail = document.createElement('aside');
    rail.className = 'tiny-navigation-rail';
    rail.innerHTML = `
      <div class="tiny-rail-brand">${tinyLogoMarkup(true)}</div>
      <button class="active" data-action="chats" aria-label="Chats">${ICONS.chats}<span>Chats</span></button>
      <button data-action="rss" aria-label="RSS channels">${ICONS.rss}<span>RSS</span></button>
      <button data-action="saved" aria-label="Saved messages">${ICONS.bookmark}<span>Saved</span></button>
      <button data-action="contacts" aria-label="New chat and contacts">${ICONS.users}<span>Contacts</span></button>
      <div class="tiny-rail-spacer"></div>
      <button data-action="settings" aria-label="Settings">${ICONS.settings}<span>Settings</span></button>
    `;
    rail.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'settings') {
        if (openSettings()) setRailActive(rail, action);
        return;
      }
      if (action === 'contacts') {
        if (openNewChat()) setRailActive(rail, action);
        return;
      }
      setRailActive(rail, action);
      if (action === 'chats') { activeFilter = 'all'; ensureChatFilters(); applyFilter(); }
      if (action === 'rss') { activeFilter = 'rss'; ensureChatFilters(); applyFilter(); }
      if (action === 'saved') openSaved();
    });
  }
  if (rail.parentElement !== shell) shell.prepend(rail);
  document.documentElement.classList.add('tiny-has-desktop-rail');
}

function ensureMobileNav() {
  let nav = document.querySelector('.tiny-mobile-nav');
  if (window.innerWidth >= 768) { nav?.remove(); return; }
  document.querySelector('.tiny-navigation-rail')?.remove();
  document.documentElement.classList.remove('tiny-has-desktop-rail');
  if (!nav) {
    nav = document.createElement('nav');
    nav.className = 'tiny-mobile-nav';
    nav.innerHTML = `
      <button class="active" data-action="chats">${ICONS.chats}<span>Chats</span></button>
      <button data-action="rss">${ICONS.rss}<span>Discover</span></button>
      <button data-action="contacts">${ICONS.users}<span>Contacts</span></button>
      <button data-action="settings">${ICONS.settings}<span>Settings</span></button>
    `;
    nav.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'settings') { openSettings(); return; }
      if (action === 'contacts') { openNewChat(); return; }
      nav.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
      if (action === 'chats') { activeFilter = 'all'; applyFilter(); }
      if (action === 'rss') { activeFilter = 'rss'; applyFilter(); }
    });
    document.body.appendChild(nav);
  }
  nav.classList.toggle('hidden-in-chat', Boolean(document.querySelector('.desktop-shell.has-active-chat')));
}

function specialAvatarIcon(text) {
  const value = text.trim();
  if (value === '★') return ICONS.savedAvatar;
  if (value === 'R') return ICONS.rssAvatar;
  if (value === 'G') return ICONS.groupAvatar;
  return null;
}

function enhanceSpecialAvatars() {
  document.querySelectorAll('.vc-avatar span').forEach((span) => {
    const icon = specialAvatarIcon(span.textContent || '');
    if (!icon || span.dataset.tinySpecialAvatar) return;
    span.dataset.tinySpecialAvatar = '1';
    span.classList.add('tiny-special-avatar');
    span.innerHTML = icon;
  });
}

function enhanceChatHeader() {
  const buttons = [...document.querySelectorAll('.chat-room-page ion-header ion-toolbar ion-buttons ion-button')];
  buttons.forEach((button) => button.classList.add('tiny-chat-header-action'));
  const labels = ['Back', 'Search messages', 'Media and files', 'Chat information'];
  buttons.forEach((button, index) => {
    if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', labels[index] || 'Chat action');
  });
}

function ensureAuthThemeToggle(card) {
  if (card.querySelector('.tiny-auth-theme')) return;
  const toggle = document.createElement('div');
  toggle.className = 'tiny-auth-theme';
  toggle.innerHTML = '<button type="button" data-theme-value="light">Light</button><button type="button" data-theme-value="dark">Dark</button><button type="button" data-theme-value="system">System</button>';
  const mode = localStorage.getItem('verdant-theme-mode') || 'system';
  toggle.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.themeValue === mode));
  toggle.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-theme-value]');
    if (!button) return;
    const selected = button.dataset.themeValue;
    localStorage.setItem('verdant-theme-mode', selected);
    const resolved = selected === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : selected;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeMode = selected;
    toggle.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
  });
  card.querySelector('p')?.after(toggle);
}

function enhanceBranding() {
  document.title = 'Tiny Chat';
  const auth = document.querySelector('.auth-card');
  if (auth) {
    auth.classList.add('tiny-auth-card');
    const logo = auth.querySelector('img');
    if (logo) { logo.src = '/icon.svg'; logo.alt = 'Tiny Chat'; }
    const heading = auth.querySelector('h1');
    if (heading) heading.textContent = 'Tiny Chat';
    const subtitle = auth.querySelector('p');
    if (subtitle) subtitle.textContent = 'Small but powerful real-time messaging.';
    ensureAuthThemeToggle(auth);
  }
  const title = document.querySelector('.chat-list-page ion-title');
  if (title && !title.querySelector('.tiny-title-brand')) title.innerHTML = `<span class="tiny-title-brand">${tinyLogoMarkup(true)}<b>Tiny Chat</b></span>`;
}

function enhanceEmptyState() {
  const state = document.querySelector('.empty-state');
  if (!state || state.dataset.tinyEnhanced) return;
  state.dataset.tinyEnhanced = '1';
  state.innerHTML = `${tinyLogoMarkup()}<h2>Welcome to Tiny Chat</h2><p>Small but powerful real-time messaging.</p><div class="tiny-empty-actions"><button type="button" data-new>${ICONS.plus} New Chat</button><button type="button" data-rss>${ICONS.rss} Open RSS</button></div><small>Press Ctrl / Cmd + K to search your chats</small>`;
  state.querySelector('[data-new]')?.addEventListener('click', openNewChat);
  state.querySelector('[data-rss]')?.addEventListener('click', () => { activeFilter = 'rss'; applyFilter(); });
}

function enhanceComposer() {
  const bar = document.querySelector('.composer-bar');
  if (!bar || bar.querySelector('.tiny-emoji-button')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tiny-emoji-button';
  button.setAttribute('aria-label', 'Emoji');
  button.innerHTML = '<span>☺</span>';
  button.addEventListener('click', () => {
    const textarea = bar.querySelector('ion-textarea');
    if (!textarea) return;
    textarea.value = `${textarea.value || ''}🙂`;
    textarea.dispatchEvent(new CustomEvent('ionInput', { detail: { value: textarea.value }, bubbles: true }));
  });
  bar.prepend(button);
}

function enhanceMedia() {
  document.querySelectorAll('.message-media').forEach((element) => {
    element.setAttribute('loading', 'lazy');
    element.setAttribute('decoding', 'async');
  });
  document.querySelectorAll('.message-bubble audio').forEach((audio) => audio.classList.add('tiny-audio-player'));
}

function enhanceAll() {
  enhanceBranding();
  ensureChatFilters();
  decorateChatRows();
  ensureDesktopRail();
  ensureMobileNav();
  enhanceSpecialAvatars();
  enhanceChatHeader();
  enhanceEmptyState();
  enhanceComposer();
  enhanceMedia();
}

const observer = new MutationObserver(() => requestAnimationFrame(enhanceAll));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('resize', () => requestAnimationFrame(enhanceAll), { passive: true });
window.addEventListener('DOMContentLoaded', enhanceAll);
setTimeout(enhanceAll, 250);
setTimeout(enhanceAll, 1000);
