import { apiOrigin } from './runtime';

const THEME_KEY = 'verdant-ui-theme';
const COLOR_KEY = 'verdant-ui-color';
const PROFILE_MODE_CLASS = 'profile-mode';
const stack = [];
let currentUser = null;
let screen = null;
let hostSidebar = null;

function assetUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? `${apiOrigin}${value}` : value;
}

function token() {
  return localStorage.getItem('verdant-token');
}

async function loadUser({ refresh = false } = {}) {
  if (currentUser && !refresh) return currentUser;
  const response = await fetch(`${apiOrigin}/api/me`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Profile could not be loaded.');
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

function header(title, subtitle = '') {
  return `
    <div class="profile-nav">
      <button class="profile-back" type="button">‹</button>
      <span><b>${escapeText(title)}</b>${subtitle ? `<small>${escapeText(subtitle)}</small>` : ''}</span>
    </div>
  `;
}

function avatarMarkup(user) {
  const avatar = assetUrl(user.avatarUrl);
  return avatar
    ? `<img src="${escapeText(avatar)}" alt="">`
    : `<span>${escapeText(String(user.displayName || user.username || 'U').slice(0, 2).toUpperCase())}</span>`;
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
    ...(user.role === 'admin' ? [row({ icon: '🛡️', title: 'Administration', subtitle: 'Users, chats and online sessions', action: () => document.querySelector('.account-launcher button[title="Administration"]')?.click() })] : []),
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
    ${header('Edit profile', 'Profile details')}
    <div class="profile-page-content">
      <div class="profile-edit-card">
        <div class="profile-page-avatar large">${avatarMarkup(user)}</div>
        <p>Profile editing uses the existing account form for now.</p>
        <button class="profile-open-account-form" type="button">Open account editor</button>
      </div>
    </div>
  `;
  root.querySelector('.profile-back')?.addEventListener('click', back);
  root.querySelector('.profile-open-account-form')?.addEventListener('click', () => document.querySelector('.account-user-launch')?.click());
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
