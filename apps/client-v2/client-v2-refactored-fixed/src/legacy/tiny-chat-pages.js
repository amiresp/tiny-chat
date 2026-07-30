import './tiny-chat-pages.css';
import { api, assetUrl } from './api';

const ICONS = {
  back: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  userPlus: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/></svg>',
  message: '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.7-5.1A7 7 0 0 1 3 12V8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.4.5.6 1.2.6 2s-.2 1.5-.6 2Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M18 5l2 2M15 8l2 2"/></svg>',
  monitor: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
};

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function currentChatId() {
  return Number(new URLSearchParams(location.search).get('chat') || 0) || null;
}

function pageUrl(view) {
  const params = new URLSearchParams(location.search);
  params.set('view', view);
  return `${location.pathname}?${params.toString()}`;
}

function returnUrl() {
  const params = new URLSearchParams(location.search);
  const chatId = params.get('chat');
  if (chatId) return `${location.pathname}?chat=${chatId}&view=chat`;
  return `${location.pathname}?view=chats`;
}

function updateUrl(view, replace = false) {
  history[replace ? 'replaceState' : 'pushState']({}, '', pageUrl(view));
}

function avatarMarkup(user, size = 'large') {
  const url = assetUrl(user?.avatarUrl || user?.avatar_url);
  const name = user?.displayName || user?.display_name || user?.username || 'User';
  const initials = name.trim().slice(0, 2).toUpperCase();
  return `<span class="tiny-page-avatar ${size}">${url ? `<img src="${esc(url)}" alt="${esc(name)}">` : `<b>${esc(initials)}</b>`}${user?.isOnline ? '<i></i>' : ''}</span>`;
}

function closeIonicLayers() {
  document.querySelectorAll('ion-modal.show-modal,ion-action-sheet.show-action-sheet').forEach((layer) => layer.dismiss?.());
}

function closePage({ historyBack = true } = {}) {
  document.querySelector('.tiny-real-page')?.remove();
  document.documentElement.classList.remove('tiny-page-open');
  if (historyBack) history.pushState({}, '', returnUrl());
}

function createPage({ title, subtitle = '', view, body, aside = '' }) {
  closeIonicLayers();
  document.querySelector('.tiny-real-page')?.remove();
  const page = document.createElement('section');
  page.className = `tiny-real-page tiny-${view}-page`;
  page.innerHTML = `
    <header class="tiny-real-page-header">
      <button type="button" class="tiny-page-back" aria-label="Back">${ICONS.back}</button>
      <div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
    </header>
    <div class="tiny-real-page-layout">
      ${aside ? `<aside class="tiny-page-aside">${aside}</aside>` : ''}
      <main class="tiny-page-main">${body}</main>
    </div>
  `;
  page.querySelector('.tiny-page-back').addEventListener('click', () => closePage());
  document.body.appendChild(page);
  document.documentElement.classList.add('tiny-page-open');
  updateUrl(view);
  return page;
}

function loadingBody() {
  return '<div class="tiny-page-loading"><span></span><span></span><span></span><p>Loading…</p></div>';
}

function emptyBody(title, text) {
  return `<div class="tiny-page-empty"><span>${ICONS.message}</span><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
}

async function startDirectChat(userId) {
  const result = await api('/api/chats/direct', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  const chatId = result.chat?.id || result.id;
  if (!chatId) throw new Error('Chat could not be opened.');
  location.href = `${location.pathname}?chat=${chatId}&view=chat`;
}

function contactCard(user, { search = false } = {}) {
  const name = user.displayName || user.username || 'User';
  const secondary = user.username ? `@${user.username}` : user.mobile || '';
  return `
    <article class="tiny-contact-card" data-user-id="${user.id}">
      ${avatarMarkup(user, 'medium')}
      <div class="tiny-contact-copy">
        <h3>${esc(name)}</h3>
        <p>${esc(secondary)}${user.mobile && secondary !== user.mobile ? ` · ${esc(user.mobile)}` : ''}</p>
        <small>${user.isOnline ? 'online' : 'Tiny Chat user'}</small>
      </div>
      <div class="tiny-contact-actions">
        ${search && !user.added ? `<button type="button" data-add title="Add contact">${ICONS.userPlus}<span>Add</span></button>` : ''}
        <button type="button" data-message class="primary" title="Message">${ICONS.message}<span>Message</span></button>
        ${!search || user.added ? `<button type="button" data-remove class="danger" title="Remove contact">${ICONS.trash}</button>` : ''}
      </div>
    </article>
  `;
}

async function openContactsPage({ replace = false } = {}) {
  const page = createPage({
    title: 'Contacts',
    subtitle: 'Find people by username or mobile number',
    view: 'contacts',
    body: `
      <section class="tiny-contacts-hero">
        <label class="tiny-page-search">${ICONS.search}<input type="search" placeholder="Search username or mobile number" autocomplete="off"></label>
        <p>Add Tiny Chat users to your contacts and start messaging instantly.</p>
      </section>
      <section class="tiny-contact-section">
        <div class="tiny-section-title"><h2>Your contacts</h2><span data-contact-count>0</span></div>
        <div class="tiny-contact-list" data-contacts>${loadingBody()}</div>
      </section>
      <section class="tiny-contact-section tiny-search-results-section" hidden>
        <div class="tiny-section-title"><h2>Search results</h2></div>
        <div class="tiny-contact-list" data-results></div>
      </section>
    `,
  });
  if (replace) updateUrl('contacts', true);

  const contactsNode = page.querySelector('[data-contacts]');
  const resultsNode = page.querySelector('[data-results]');
  const resultsSection = page.querySelector('.tiny-search-results-section');
  const countNode = page.querySelector('[data-contact-count]');
  const searchInput = page.querySelector('input[type=search]');
  let searchTimer;

  async function loadContacts() {
    try {
      const data = await api('/api/v2/contacts');
      const contacts = data.contacts || [];
      countNode.textContent = String(contacts.length);
      contactsNode.innerHTML = contacts.length
        ? contacts.map((user) => contactCard(user)).join('')
        : emptyBody('No contacts yet', 'Search by username or mobile number to add your first contact.');
    } catch (error) {
      contactsNode.innerHTML = emptyBody('Contacts unavailable', error.message);
    }
  }

  async function searchUsers(query) {
    if (query.length < 2) {
      resultsSection.hidden = true;
      resultsNode.innerHTML = '';
      return;
    }
    resultsSection.hidden = false;
    resultsNode.innerHTML = loadingBody();
    try {
      const data = await api(`/api/v2/contacts/search?q=${encodeURIComponent(query)}`);
      const users = data.users || [];
      resultsNode.innerHTML = users.length
        ? users.map((user) => contactCard(user, { search: true })).join('')
        : emptyBody('No user found', 'Try an exact username or a complete mobile number.');
    } catch (error) {
      resultsNode.innerHTML = emptyBody('Search failed', error.message);
    }
  }

  page.addEventListener('click', async (event) => {
    const card = event.target.closest('.tiny-contact-card');
    if (!card) return;
    const userId = Number(card.dataset.userId);
    const button = event.target.closest('button');
    if (!button) return;
    button.disabled = true;
    try {
      if (button.matches('[data-add]')) {
        await api('/api/v2/contacts', { method: 'POST', body: JSON.stringify({ userId }) });
        button.remove();
        await loadContacts();
      }
      if (button.matches('[data-remove]')) {
        await api(`/api/v2/contacts/${userId}`, { method: 'DELETE' });
        card.remove();
        await loadContacts();
      }
      if (button.matches('[data-message]')) await startDirectChat(userId);
    } catch (error) {
      button.disabled = false;
      alert(error.message);
    }
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchUsers(searchInput.value.trim()), 300);
  });

  loadContacts();
}

function settingsAside(active) {
  const items = [
    ['profile', 'Profile', ICONS.settings],
    ['appearance', 'Appearance', ICONS.monitor],
    ['privacy', 'Privacy', ICONS.shield],
    ['security', 'Security', ICONS.key],
    ['sessions', 'Sessions', ICONS.monitor],
  ];
  return `<nav class="tiny-settings-nav">${items.map(([key, label, icon]) => `<button type="button" data-settings-tab="${key}" class="${key === active ? 'active' : ''}">${icon}<span>${label}</span></button>`).join('')}</nav>`;
}

async function openSettingsPage({ replace = false } = {}) {
  const page = createPage({
    title: 'Settings',
    subtitle: 'Manage your Tiny Chat account and preferences',
    view: 'settings',
    aside: settingsAside('profile'),
    body: `<div class="tiny-settings-content">${loadingBody()}</div>`,
  });
  if (replace) updateUrl('settings', true);
  const content = page.querySelector('.tiny-settings-content');
  let state = { me: null, privacy: null, sessions: [] };

  async function loadState() {
    const [me, privacy, sessions] = await Promise.all([
      api('/api/me'),
      api('/api/v2/privacy').catch(() => ({ privacy: {} })),
      api('/api/v2/sessions').catch(() => ({ sessions: [] })),
    ]);
    state = { me: me.user, privacy: privacy.privacy || {}, sessions: sessions.sessions || [] };
  }

  function renderProfile() {
    const user = state.me || {};
    content.innerHTML = `
      <section class="tiny-settings-panel">
        <div class="tiny-profile-summary">${avatarMarkup(user)}<div><h2>${esc(user.displayName || user.username || 'Tiny Chat user')}</h2><p>@${esc(user.username || '')}</p></div></div>
        <form data-profile-form class="tiny-settings-form">
          <label>Display name<input name="displayName" value="${esc(user.displayName || '')}"></label>
          <label>Username<input name="username" value="${esc(user.username || '')}"></label>
          <label>Mobile number<input name="mobile" value="${esc(user.mobile || '')}"></label>
          <label class="tiny-switch-row"><span><b>Hide online presence</b><small>Other users will not see when you are online.</small></span><input name="hidePresence" type="checkbox" ${user.hidePresence ? 'checked' : ''}></label>
          <button type="submit" class="tiny-primary-button">Save profile</button>
        </form>
      </section>`;
    content.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = await api('/api/me', { method: 'PATCH', body: JSON.stringify({ displayName: form.get('displayName'), username: form.get('username'), mobile: form.get('mobile'), hidePresence: form.get('hidePresence') === 'on' }) });
      state.me = result.user;
      renderProfile();
    });
  }

  function renderAppearance() {
    const current = localStorage.getItem('verdant-theme-mode') || 'system';
    content.innerHTML = `<section class="tiny-settings-panel"><h2>Appearance</h2><p class="tiny-panel-description">Choose how Tiny Chat looks on this device.</p><div class="tiny-theme-grid">${['light', 'dark', 'system'].map((mode) => `<button type="button" data-theme="${mode}" class="${current === mode ? 'active' : ''}"><span class="tiny-theme-preview ${mode}"></span><b>${mode[0].toUpperCase() + mode.slice(1)}</b><small>${mode === 'system' ? 'Follow device settings' : `${mode} color scheme`}</small></button>`).join('')}</div></section>`;
    content.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => {
      const mode = button.dataset.theme;
      localStorage.setItem('verdant-theme-mode', mode);
      const resolved = mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themeMode = mode;
      renderAppearance();
    }));
  }

  function renderPrivacy() {
    const privacy = state.privacy || {};
    content.innerHTML = `<section class="tiny-settings-panel"><h2>Privacy</h2><form data-privacy-form class="tiny-settings-form"><label class="tiny-switch-row"><span><b>Read receipts</b><small>Allow people to see when messages are read.</small></span><input name="readReceipts" type="checkbox" ${privacy.read_receipts ? 'checked' : ''}></label><label>Last seen<select name="lastSeen"><option value="everyone" ${privacy.last_seen === 'everyone' ? 'selected' : ''}>Everyone</option><option value="nobody" ${privacy.last_seen === 'nobody' ? 'selected' : ''}>Nobody</option></select></label><label>Who can message me<select name="allowMessages"><option value="everyone" ${privacy.allow_messages === 'everyone' ? 'selected' : ''}>Everyone</option><option value="contacts" ${privacy.allow_messages === 'contacts' ? 'selected' : ''}>My contacts</option></select></label><button type="submit" class="tiny-primary-button">Save privacy</button></form></section>`;
    content.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await api('/api/v2/privacy', { method: 'PATCH', body: JSON.stringify({ readReceipts: form.get('readReceipts') === 'on', lastSeen: form.get('lastSeen'), allowMessages: form.get('allowMessages') }) });
      state.privacy = { read_receipts: form.get('readReceipts') === 'on', last_seen: form.get('lastSeen'), allow_messages: form.get('allowMessages') };
      renderPrivacy();
    });
  }

  function renderSecurity() {
    content.innerHTML = `<section class="tiny-settings-panel"><h2>Security</h2><p class="tiny-panel-description">Use a strong password that you do not use elsewhere.</p><form data-password-form class="tiny-settings-form"><label>Current password<input type="password" name="currentPassword" autocomplete="current-password"></label><label>New password<input type="password" name="newPassword" minlength="8" autocomplete="new-password"></label><button type="submit" class="tiny-primary-button">Change password</button></form></section>`;
    content.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await api('/api/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') }) });
      event.currentTarget.reset();
      alert('Password changed successfully.');
    });
  }

  function renderSessions() {
    content.innerHTML = `<section class="tiny-settings-panel"><h2>Active sessions</h2><p class="tiny-panel-description">Devices currently signed in to your account.</p><div class="tiny-session-list">${state.sessions.length ? state.sessions.map((session) => `<article data-session-id="${esc(session.id)}"><span>${ICONS.monitor}</span><div><b>${esc(String(session.id).slice(0, 12))}</b><small>Last used ${esc(new Date(session.last_used_at).toLocaleString())}</small></div><button type="button">Log out</button></article>`).join('') : emptyBody('No other sessions', 'Your active sessions will appear here.')}</div></section>`;
    content.querySelectorAll('[data-session-id] button').forEach((button) => button.addEventListener('click', async () => {
      const article = button.closest('[data-session-id]');
      await api(`/api/v2/sessions/${article.dataset.sessionId}`, { method: 'DELETE' });
      state.sessions = state.sessions.filter((session) => session.id !== article.dataset.sessionId);
      renderSessions();
    }));
  }

  const renderers = { profile: renderProfile, appearance: renderAppearance, privacy: renderPrivacy, security: renderSecurity, sessions: renderSessions };
  page.querySelector('.tiny-settings-nav').addEventListener('click', (event) => {
    const button = event.target.closest('[data-settings-tab]');
    if (!button) return;
    page.querySelectorAll('[data-settings-tab]').forEach((item) => item.classList.toggle('active', item === button));
    renderers[button.dataset.settingsTab]?.();
  });

  try {
    await loadState();
    renderProfile();
  } catch (error) {
    content.innerHTML = emptyBody('Settings unavailable', error.message);
  }
}

async function openProfilePage({ replace = false } = {}) {
  const chatId = currentChatId();
  if (!chatId) return;
  const page = createPage({ title: 'Profile', subtitle: 'User and conversation information', view: 'profile', body: loadingBody() });
  if (replace) updateUrl('profile', true);
  const main = page.querySelector('.tiny-page-main');
  try {
    const [info, me, contacts] = await Promise.all([
      api(`/api/v2/chats/${chatId}/info`),
      api('/api/me'),
      api('/api/v2/contacts').catch(() => ({ contacts: [] })),
    ]);
    const chat = info.chat || {};
    const ownId = Number(me.user?.id);
    const peer = chat.type === 'direct' ? (info.members || []).find((member) => Number(member.id) !== ownId) : null;
    const subject = peer || { display_name: chat.title || 'Saved Messages', username: chat.type, avatar_url: chat.avatar_url };
    const name = subject.display_name || subject.displayName || subject.username || 'Tiny Chat';
    const isContact = peer && (contacts.contacts || []).some((contact) => Number(contact.id) === Number(peer.id));
    main.innerHTML = `
      <section class="tiny-profile-page-card">
        <div class="tiny-profile-cover"></div>
        <div class="tiny-profile-identity">${avatarMarkup(subject)}<h2>${esc(name)}</h2><p>${peer?.username ? `@${esc(peer.username)}` : esc(chat.type || '')}</p><span>${peer ? 'Tiny Chat user' : chat.type === 'saved' ? 'Your private saved messages' : 'Conversation'}</span></div>
        <div class="tiny-profile-actions">
          ${peer ? `<button type="button" data-message class="primary">${ICONS.message}<span>Message</span></button><button type="button" data-contact>${isContact ? ICONS.trash : ICONS.userPlus}<span>${isContact ? 'Remove contact' : 'Add contact'}</span></button>` : ''}
        </div>
        <div class="tiny-profile-details">
          ${peer?.mobile ? `<article><b>Mobile</b><span>${esc(peer.mobile)}</span></article>` : ''}
          ${peer?.username ? `<article><b>Username</b><span>@${esc(peer.username)}</span></article>` : ''}
          <article><b>Conversation</b><span>${esc(chat.type || 'chat')}</span></article>
          ${(info.members || []).length > 1 ? `<article><b>Members</b><span>${info.members.length}</span></article>` : ''}
        </div>
      </section>`;
    main.querySelector('[data-message]')?.addEventListener('click', () => closePage());
    main.querySelector('[data-contact]')?.addEventListener('click', async (event) => {
      if (isContact) await api(`/api/v2/contacts/${peer.id}`, { method: 'DELETE' });
      else await api('/api/v2/contacts', { method: 'POST', body: JSON.stringify({ userId: peer.id }) });
      event.currentTarget.querySelector('span').textContent = isContact ? 'Add contact' : 'Remove contact';
    });
  } catch (error) {
    main.innerHTML = emptyBody('Profile unavailable', error.message);
  }
}

function interceptNavigation(event) {
  const target = event.target;
  const settings = target.closest('.tiny-navigation-rail [data-action="settings"],.tiny-mobile-nav [data-action="settings"],.chat-list-page ion-toolbar:first-child ion-buttons ion-button:first-child');
  const contacts = target.closest('.tiny-navigation-rail [data-action="contacts"],.tiny-mobile-nav [data-action="contacts"]');
  const profile = target.closest('.room-title,.chat-room-page ion-header ion-buttons[slot="end"] ion-button:last-child');
  if (!settings && !contacts && !profile) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  if (settings) openSettingsPage();
  if (contacts) openContactsPage();
  if (profile) openProfilePage();
}

document.addEventListener('click', interceptNavigation, true);
window.addEventListener('popstate', () => {
  document.querySelector('.tiny-real-page')?.remove();
  document.documentElement.classList.remove('tiny-page-open');
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'settings') openSettingsPage({ replace: true });
  if (view === 'contacts') openContactsPage({ replace: true });
  if (view === 'profile') openProfilePage({ replace: true });
});

function restorePageFromUrl() {
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'settings') openSettingsPage({ replace: true });
  if (view === 'contacts') openContactsPage({ replace: true });
  if (view === 'profile') openProfilePage({ replace: true });
}

window.addEventListener('DOMContentLoaded', () => setTimeout(restorePageFromUrl, 450));
