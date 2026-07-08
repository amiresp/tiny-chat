import { apiOrigin } from './runtime';

const THEME_KEY = 'verdant-ui-theme';
const COLOR_KEY = 'verdant-ui-color';
const PROFILE_MODE_CLASS = 'profile-mode';
const stack = [];
let currentUser = null;
let screen = null;
let hostSidebar = null;
let adminLoaded = false;
let adminState = { tab: 'overview', users: [], online: [], chats: [], messages: [], selectedChat: null, query: '', busy: false, error: '' };

function assetUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? `${apiOrigin}${value}` : value;
}

function token() {
  return localStorage.getItem('verdant-token');
}

async function request(path, options = {}) {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token()}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || 'Request failed.');
  return data;
}

async function loadUser({ refresh = false } = {}) {
  if (currentUser && !refresh) return currentUser;
  const data = await request('/api/me');
  currentUser = data.user;
  return currentUser;
}

function applyTheme() {
  const color = localStorage.getItem(COLOR_KEY) || 'green';
  const theme = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.dataset.appColor = color;
  document.documentElement.dataset.appTheme = theme;
}

function setTheme({ color, theme }) {
  if (color) localStorage.setItem(COLOR_KEY, color);
  if (theme) localStorage.setItem(THEME_KEY, theme);
  applyTheme();
  renderCurrent();
}

function sidebar() {
  return document.querySelector('.sidebar:not(.mobile-hidden), .sidebar');
}

function ensureScreen() {
  hostSidebar = sidebar();
  if (!hostSidebar) return null;
  hostSidebar.classList.add(PROFILE_MODE_CLASS);
  screen = hostSidebar.querySelector('.profile-screen');
  if (!screen) {
    screen = document.createElement('section');
    screen.className = 'profile-screen';
    hostSidebar.appendChild(screen);
  }
  return screen;
}

function closeProfile() {
  hostSidebar?.classList.remove(PROFILE_MODE_CLASS);
  screen?.remove();
  screen = null;
  stack.length = 0;
}

function push(view) {
  stack.push(view);
  renderCurrent('forward');
}

function back() {
  if (stack.length <= 1) {
    closeProfile();
    return;
  }
  stack.pop();
  renderCurrent('back');
}

function signOut() {
  localStorage.removeItem('verdant-token');
  window.location.reload();
}

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function userLabel(user) {
  return user?.displayName || user?.username || `User #${user?.id ?? '—'}`;
}

function header(title, subtitle = '') {
  return `
    <div class="profile-nav">
      <button class="profile-back" type="button">‹</button>
      <span><b>${escapeText(title)}</b>${subtitle ? `<small>${escapeText(subtitle)}</small>` : ''}</span>
    </div>
  `;
}

function avatarMarkup(user) {
  const avatar = assetUrl(user?.avatarUrl);
  return avatar
    ? `<img src="${escapeText(avatar)}" alt="">`
    : `<span>${escapeText(String(userLabel(user)).slice(0, 2).toUpperCase())}</span>`;
}

function row({ icon, title, subtitle, action, danger = false }) {
  const button = document.createElement('button');
  button.className = `profile-page-row ${danger ? 'danger' : ''}`;
  button.type = 'button';
  button.innerHTML = `<span class="profile-row-icon">${icon}</span><span><b>${escapeText(title)}</b><small>${escapeText(subtitle)}</small></span><em>›</em>`;
  button.addEventListener('click', action);
  return button;
}

function themeButton({ label, active, action }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = active ? 'active' : '';
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

function notice(message, type = 'error') {
  return message ? `<div class="profile-notice ${type}">${escapeText(message)}</div>` : '';
}

async function requestNotifications() {
  if (!('Notification' in window)) {
    alert('Notifications are not supported on this device.');
    return;
  }
  await window.Notification.requestPermission();
}

async function updateApplication() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  window.location.reload();
}

function renderProfile(root, user) {
  root.innerHTML = `
    ${header('Profile', '@' + (user.username || 'user'))}
    <div class="profile-hero-card">
      <div class="profile-page-avatar">${avatarMarkup(user)}</div>
      <div class="profile-page-title">
        <h2>${escapeText(user.displayName || user.username || 'Profile')}</h2>
        <p>@${escapeText(user.username || 'user')}</p>
      </div>
      <button class="profile-page-edit" type="button">Edit profile</button>
    </div>
    <div class="profile-page-content"></div>
  `;
  root.querySelector('.profile-back')?.addEventListener('click', closeProfile);
  root.querySelector('.profile-page-edit')?.addEventListener('click', () => push('edit'));
  const content = root.querySelector('.profile-page-content');
  const accountGroup = document.createElement('div');
  accountGroup.className = 'profile-page-group';
  accountGroup.append(
    row({ icon: '👤', title: 'Account', subtitle: 'Name, avatar, privacy and password', action: () => push('edit') }),
    ...(user.role === 'admin' ? [row({ icon: '🛡️', title: 'Administration', subtitle: 'Users, chats and online sessions', action: () => push('admin') })] : []),
  );
  const settingsGroup = document.createElement('div');
  settingsGroup.className = 'profile-page-group';
  settingsGroup.append(
    row({ icon: '🎨', title: 'Settings', subtitle: 'Theme, color and app preferences', action: () => push('settings') }),
    row({ icon: '🔔', title: 'Notifications', subtitle: 'Enable notification permission', action: requestNotifications }),
    row({ icon: '♻️', title: 'Update application', subtitle: 'Clear PWA cache and reload', action: updateApplication }),
    row({ icon: '🚪', title: 'Sign out', subtitle: 'Exit this account', action: signOut, danger: true }),
  );
  content.append(accountGroup, settingsGroup);
}

function renderSettings(root) {
  const color = localStorage.getItem(COLOR_KEY) || 'green';
  const theme = localStorage.getItem(THEME_KEY) || 'light';
  root.innerHTML = `${header('Settings', 'Personalize Verdant')}<div class="profile-page-content"></div>`;
  root.querySelector('.profile-back')?.addEventListener('click', back);
  const content = root.querySelector('.profile-page-content');
  const settingsGroup = document.createElement('div');
  settingsGroup.className = 'profile-page-group';
  settingsGroup.innerHTML = '<h3>Appearance</h3>';

  const colorControl = document.createElement('div');
  colorControl.className = 'profile-setting-control';
  colorControl.innerHTML = '<span><b>Accent color</b><small>Choose your app color</small></span>';
  const colorOptions = document.createElement('div');
  colorOptions.className = 'profile-segmented';
  colorOptions.append(
    themeButton({ label: 'Green', active: color === 'green', action: () => setTheme({ color: 'green' }) }),
    themeButton({ label: 'Blue', active: color === 'blue', action: () => setTheme({ color: 'blue' }) }),
  );
  colorControl.appendChild(colorOptions);

  const modeControl = document.createElement('div');
  modeControl.className = 'profile-setting-control';
  modeControl.innerHTML = '<span><b>Theme</b><small>Light or dark mode</small></span>';
  const modeOptions = document.createElement('div');
  modeOptions.className = 'profile-segmented';
  modeOptions.append(
    themeButton({ label: 'Light', active: theme === 'light', action: () => setTheme({ theme: 'light' }) }),
    themeButton({ label: 'Dark', active: theme === 'dark', action: () => setTheme({ theme: 'dark' }) }),
  );
  modeControl.appendChild(modeOptions);
  settingsGroup.append(colorControl, modeControl);
  content.append(settingsGroup);
}

function renderEdit(root, user) {
  root.innerHTML = `
    ${header('Edit profile', 'Profile and password')}
    <div class="profile-page-content">
      <div class="profile-edit-card">
        <div class="profile-page-avatar large">${avatarMarkup(user)}</div>
        <input class="profile-avatar-input" type="file" accept="image/*" hidden>
        <button class="profile-open-account-form profile-avatar-button" type="button">Change avatar</button>
      </div>
      <div class="profile-page-group">
        <h3>Profile</h3>
        <form class="profile-form" data-profile-form>
          <label>Display name<input name="displayName" value="${escapeText(user.displayName || '')}" placeholder="Your visible name"></label>
          <label>Username<input name="username" value="${escapeText(user.username || '')}" required autocomplete="username"></label>
          <label>Mobile number<input name="mobile" value="${escapeText(user.mobile || '')}" required inputmode="tel"></label>
          <label class="profile-check"><input name="hidePresence" type="checkbox" ${user.hidePresence ? 'checked' : ''}><span><b>Hide online status</b><small>Other users will not see your online status and last seen.</small></span></label>
          <button class="profile-submit" type="submit">Save profile</button>
        </form>
      </div>
      <div class="profile-page-group">
        <h3>Password</h3>
        <form class="profile-form" data-password-form>
          <label>Current password<input name="currentPassword" type="password" autocomplete="current-password"></label>
          <label>New password<input name="newPassword" type="password" autocomplete="new-password"></label>
          <label>Confirm new password<input name="confirmPassword" type="password" autocomplete="new-password"></label>
          <button class="profile-submit" type="submit">Change password</button>
        </form>
      </div>
    </div>
  `;
  root.querySelector('.profile-back')?.addEventListener('click', back);
  const avatarInput = root.querySelector('.profile-avatar-input');
  root.querySelector('.profile-avatar-button')?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Choose an image file.');
    const formData = new FormData();
    formData.append('avatar', file, file.name);
    try {
      const data = await request('/api/v2/me/avatar', { method: 'POST', body: formData });
      currentUser = data.user;
      renderCurrent();
    } catch (error) {
      alert(error.message);
    }
  });
  root.querySelector('[data-profile-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await request('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: String(form.get('displayName') || '').trim(),
          username: String(form.get('username') || '').trim(),
          mobile: String(form.get('mobile') || '').trim(),
          hidePresence: Boolean(form.get('hidePresence')),
        }),
      });
      currentUser = data.user;
      renderEdit(root, currentUser);
    } catch (error) {
      alert(error.message);
    }
  });
  root.querySelector('[data-password-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('newPassword') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    if (newPassword.length < 8) return alert('New password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return alert('New password confirmation does not match.');
    try {
      await request('/api/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: String(form.get('currentPassword') || ''), newPassword }),
      });
      event.currentTarget.reset();
      alert('Password changed successfully.');
    } catch (error) {
      alert(error.message);
    }
  });
}

async function loadAdminData({ keepTab = true } = {}) {
  if (adminState.busy) return;
  adminState = { ...adminState, busy: true, error: '', selectedChat: keepTab ? adminState.selectedChat : null };
  renderCurrent();
  try {
    const [usersData, chatsData, onlineData] = await Promise.all([
      request('/api/admin/users'),
      request('/api/admin/chats'),
      request('/api/v2/admin/online-users'),
    ]);
    adminLoaded = true;
    adminState = { ...adminState, users: usersData.users || [], chats: chatsData.chats || [], online: onlineData.users || [], busy: false, error: '' };
  } catch (error) {
    adminLoaded = true;
    adminState = { ...adminState, busy: false, error: error.message };
  }
  renderCurrent();
}

async function inspectAdminChat(chat) {
  adminState = { ...adminState, selectedChat: chat, messages: [], busy: true, error: '' };
  renderCurrent();
  try {
    const data = await request(`/api/admin/chats/${chat.id}/messages`);
    adminState = { ...adminState, messages: data.messages || [], busy: false };
  } catch (error) {
    adminState = { ...adminState, error: error.message, busy: false };
  }
  renderCurrent();
}

async function toggleBan(user) {
  try {
    await request(`/api/admin/users/${user.id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned: !user.isBanned }) });
    adminState = { ...adminState, users: adminState.users.map((item) => item.id === user.id ? { ...item, isBanned: !user.isBanned } : item) };
    renderCurrent();
  } catch (error) {
    alert(error.message);
  }
}

function renderAdmin(root) {
  const user = currentUser;
  if (user?.role !== 'admin') {
    root.innerHTML = `${header('Administration', 'Access denied')}<div class="profile-page-content"><div class="profile-page-group">Only administrators can access this page.</div></div>`;
    root.querySelector('.profile-back')?.addEventListener('click', back);
    return;
  }
  root.innerHTML = `${header('Administration', 'Users, sessions and chats')}<div class="profile-page-content admin-stack-page"></div>`;
  root.querySelector('.profile-back')?.addEventListener('click', back);
  const content = root.querySelector('.profile-page-content');
  const tabs = document.createElement('div');
  tabs.className = 'profile-admin-tabs';
  ['overview', 'online', 'users', 'chats'].forEach((tab) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = adminState.tab === tab ? 'active' : '';
    button.textContent = tab;
    button.addEventListener('click', () => { adminState = { ...adminState, tab, selectedChat: null }; renderCurrent(); });
    tabs.appendChild(button);
  });
  const refresh = document.createElement('button');
  refresh.className = 'profile-admin-refresh';
  refresh.textContent = 'Refresh';
  refresh.addEventListener('click', () => loadAdminData());
  content.append(tabs, refresh);
  if (adminState.error) content.insertAdjacentHTML('beforeend', notice(adminState.error));
  if (!adminLoaded && !adminState.busy) {
    loadAdminData();
  }
  if (adminState.busy) {
    content.insertAdjacentHTML('beforeend', '<div class="profile-admin-loading">Loading…</div>');
    return;
  }
  const panel = document.createElement('div');
  panel.className = 'profile-page-group profile-admin-panel';
  if (adminState.tab === 'overview') {
    const stats = {
      users: adminState.users.length,
      online: adminState.online.length,
      banned: adminState.users.filter((item) => item.isBanned).length,
      chats: adminState.chats.length,
    };
    panel.innerHTML = `<h3>Overview</h3><div class="profile-admin-stats"><article><b>${stats.users}</b><small>Users</small></article><article><b>${stats.online}</b><small>Online</small></article><article><b>${stats.banned}</b><small>Banned</small></article><article><b>${stats.chats}</b><small>Chats</small></article></div>`;
  } else if (adminState.tab === 'online') {
    panel.innerHTML = '<h3>Online users</h3>';
    const list = document.createElement('div');
    list.className = 'profile-admin-list';
    list.innerHTML = adminState.online.length ? adminState.online.map((item) => `<article><span class="mini-avatar">${avatarMarkup(item)}</span><span><b>${escapeText(userLabel(item))}</b><small>@${escapeText(item.username || '')} · ${item.connections || 1} connection</small></span><em>online</em></article>`).join('') : '<p>No users are online.</p>';
    panel.appendChild(list);
  } else if (adminState.tab === 'users') {
    panel.innerHTML = '<h3>Users</h3><input class="profile-admin-search" placeholder="Search users">';
    const list = document.createElement('div');
    list.className = 'profile-admin-list';
    const renderUsers = () => {
      const q = panel.querySelector('.profile-admin-search')?.value?.toLowerCase() || '';
      const users = adminState.users.filter((item) => !q || [item.displayName, item.username, item.mobile, item.role].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
      list.innerHTML = '';
      users.forEach((item) => {
        const article = document.createElement('article');
        article.innerHTML = `<span class="mini-avatar">${avatarMarkup(item)}</span><span><b>${escapeText(userLabel(item))}</b><small>@${escapeText(item.username || '')} · ${escapeText(item.mobile || '—')} · ${escapeText(item.role || 'user')}</small></span>`;
        const button = document.createElement('button');
        button.className = item.isBanned ? 'profile-admin-positive' : 'profile-admin-danger';
        button.textContent = item.isBanned ? 'Unban' : 'Ban';
        button.addEventListener('click', () => toggleBan(item));
        article.appendChild(button);
        list.appendChild(article);
      });
    };
    panel.querySelector('.profile-admin-search')?.addEventListener('input', renderUsers);
    renderUsers();
    panel.appendChild(list);
  } else if (adminState.tab === 'chats') {
    panel.innerHTML = '<h3>Chats</h3>';
    if (adminState.selectedChat) {
      const backButton = document.createElement('button');
      backButton.className = 'profile-admin-refresh';
      backButton.textContent = 'Back to chats';
      backButton.addEventListener('click', () => { adminState = { ...adminState, selectedChat: null, messages: [] }; renderCurrent(); });
      panel.appendChild(backButton);
      const messages = document.createElement('div');
      messages.className = 'profile-admin-messages';
      messages.innerHTML = adminState.messages.length ? adminState.messages.map((message) => `<article><b>User #${message.senderId}</b><p>${escapeText(message.body || message.fileName || `Message #${message.id}`)}</p><small>${escapeText(formatDate(message.createdAt))}</small></article>`).join('') : '<p>No messages found in this chat.</p>';
      panel.appendChild(messages);
    } else {
      const list = document.createElement('div');
      list.className = 'profile-admin-list';
      adminState.chats.forEach((chat) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.innerHTML = `<span><b>${escapeText(chat.title || `${chat.type} chat #${chat.id}`)}</b><small>${escapeText(chat.type)} · Owner #${escapeText(chat.ownerId ?? '—')} · ${escapeText(formatDate(chat.updatedAt))}</small></span><em>›</em>`;
        button.addEventListener('click', () => inspectAdminChat(chat));
        list.appendChild(button);
      });
      panel.appendChild(list);
    }
  }
  content.appendChild(panel);
}

async function renderCurrent(direction = 'forward') {
  applyTheme();
  const root = ensureScreen();
  if (!root) return;
  const user = await loadUser();
  root.classList.remove('slide-forward', 'slide-back');
  root.classList.add(direction === 'back' ? 'slide-back' : 'slide-forward');
  const current = stack[stack.length - 1] || 'profile';
  if (current === 'settings') renderSettings(root, user);
  else if (current === 'edit') renderEdit(root, user);
  else if (current === 'admin') renderAdmin(root);
  else renderProfile(root, user);
}

function openProfile() {
  if (!stack.length) stack.push('profile');
  renderCurrent('forward').catch(() => {});
}

function shouldOpenProfile(target) {
  return Boolean(target.closest('.sidebar-profile-button'))
    || Boolean(target.closest('.mobile-bottom-navigation button:nth-child(2)'));
}

function shouldCloseProfileFromChats(target) {
  return Boolean(target.closest('.mobile-bottom-navigation button:nth-child(1)'));
}

document.addEventListener('click', (event) => {
  if (shouldCloseProfileFromChats(event.target)) {
    closeProfile();
    return;
  }

  if (!shouldOpenProfile(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  openProfile();
}, true);

window.addEventListener('storage', applyTheme);
applyTheme();
