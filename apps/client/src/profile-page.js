import { apiOrigin } from './runtime';

const THEME_KEY = 'verdant-ui-theme';
const COLOR_KEY = 'verdant-ui-color';
let currentUser = null;
let profilePage = null;

function assetUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? `${apiOrigin}${value}` : value;
}

function token() {
  return localStorage.getItem('verdant-token');
}

async function loadUser() {
  if (currentUser) return currentUser;
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
  renderProfilePage();
}

function closeProfilePage() {
  if (!profilePage) return;
  profilePage.classList.add('closing');
  window.setTimeout(() => {
    profilePage?.remove();
    profilePage = null;
  }, 220);
}

function openAccountPanel(selector) {
  closeProfilePage();
  window.setTimeout(() => document.querySelector(selector)?.click(), 230);
}

function signOut() {
  localStorage.removeItem('verdant-token');
  window.location.reload();
}

function row({ icon, title, subtitle, action, danger = false }) {
  const button = document.createElement('button');
  button.className = `profile-page-row ${danger ? 'danger' : ''}`;
  button.type = 'button';
  button.innerHTML = `<span class="profile-row-icon">${icon}</span><span><b>${title}</b><small>${subtitle}</small></span><em>›</em>`;
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

async function renderProfilePage() {
  applyTheme();
  const user = await loadUser();
  const color = localStorage.getItem(COLOR_KEY) || 'green';
  const theme = localStorage.getItem(THEME_KEY) || 'light';

  if (!profilePage) {
    profilePage = document.createElement('div');
    profilePage.className = 'profile-page-overlay';
    document.body.appendChild(profilePage);
  }

  profilePage.innerHTML = '';
  const page = document.createElement('section');
  page.className = 'profile-page';

  const avatar = assetUrl(user.avatarUrl);
  page.innerHTML = `
    <header class="profile-page-hero">
      <button class="profile-page-close" type="button" aria-label="Close">×</button>
      <div class="profile-page-avatar">${avatar ? `<img src="${avatar}" alt="">` : `<span>${String(user.displayName || user.username || 'U').slice(0, 2).toUpperCase()}</span>`}</div>
      <div class="profile-page-title">
        <h2>${user.displayName || user.username || 'Profile'}</h2>
        <p>@${user.username || 'user'}</p>
      </div>
      <button class="profile-page-edit" type="button">Edit profile</button>
    </header>
    <div class="profile-page-content"></div>
  `;

  profilePage.appendChild(page);
  page.querySelector('.profile-page-close')?.addEventListener('click', closeProfilePage);
  page.querySelector('.profile-page-edit')?.addEventListener('click', () => openAccountPanel('.account-user-launch'));
  profilePage.addEventListener('mousedown', (event) => {
    if (event.target === profilePage) closeProfilePage();
  }, { once: true });

  const content = page.querySelector('.profile-page-content');

  const accountGroup = document.createElement('div');
  accountGroup.className = 'profile-page-group';
  accountGroup.append(
    row({ icon: '👤', title: 'Account', subtitle: 'Name, avatar, privacy and password', action: () => openAccountPanel('.account-user-launch') }),
    ...(user.role === 'admin' ? [row({ icon: '🛡️', title: 'Administration', subtitle: 'Users, chats and online sessions', action: () => openAccountPanel('.account-launcher button[title="Administration"]') })] : []),
  );

  const settingsGroup = document.createElement('div');
  settingsGroup.className = 'profile-page-group';
  const settingsTitle = document.createElement('h3');
  settingsTitle.textContent = 'Settings';
  settingsGroup.appendChild(settingsTitle);

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
  modeControl.innerHTML = '<span><b>Appearance</b><small>Light or dark mode</small></span>';
  const modeOptions = document.createElement('div');
  modeOptions.className = 'profile-segmented';
  modeOptions.append(
    themeButton({ label: 'Light', active: theme === 'light', action: () => setTheme({ theme: 'light' }) }),
    themeButton({ label: 'Dark', active: theme === 'dark', action: () => setTheme({ theme: 'dark' }) }),
  );
  modeControl.appendChild(modeOptions);
  settingsGroup.append(colorControl, modeControl);

  const appGroup = document.createElement('div');
  appGroup.className = 'profile-page-group';
  appGroup.append(
    row({ icon: '🔔', title: 'Notifications', subtitle: 'Enable notifications from browser prompt', action: async () => Notification?.requestPermission?.() }),
    row({ icon: '♻️', title: 'Update application', subtitle: 'Clear PWA cache and reload', action: async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      window.location.reload();
    } }),
    row({ icon: '🚪', title: 'Sign out', subtitle: 'Exit this account', action: signOut, danger: true }),
  );

  content.append(accountGroup, settingsGroup, appGroup);
}

function shouldOpenProfile(target) {
  return Boolean(target.closest('.sidebar-profile-button'))
    || Boolean(target.closest('.mobile-bottom-navigation button:nth-child(2)'));
}

document.addEventListener('click', (event) => {
  if (!shouldOpenProfile(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  renderProfilePage().catch(() => {});
}, true);

window.addEventListener('storage', applyTheme);
applyTheme();
