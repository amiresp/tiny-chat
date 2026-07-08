import { apiOrigin } from './runtime';

const token = () => localStorage.getItem('verdant-token');
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

async function api(path, options = {}) {
  const response = await fetch(`${apiOrigin}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || 'Request failed.');
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function closeAdminScreen() {
  document.querySelector('.restored-admin-screen')?.remove();
}

async function openAdminScreen() {
  closeAdminScreen();
  const sidebar = document.querySelector('.sidebar.profile-mode, .sidebar:not(.mobile-hidden), .sidebar');
  if (!sidebar) return;

  const screen = document.createElement('section');
  screen.className = 'profile-screen restored-admin-screen slide-forward';
  screen.innerHTML = `
    <div class="profile-nav">
      <button class="profile-back" type="button">‹</button>
      <span><b>Administration</b><small>Users, sessions and chats</small></span>
    </div>
    <div class="profile-page-content admin-stack-page">
      <div class="profile-admin-loading">Loading…</div>
    </div>
  `;
  screen.querySelector('.profile-back').addEventListener('click', closeAdminScreen);
  sidebar.appendChild(screen);

  const body = screen.querySelector('.profile-page-content');
  try {
    const [usersData, chatsData, onlineData] = await Promise.all([
      api('/api/admin/users'),
      api('/api/admin/chats'),
      api('/api/v2/admin/online-users'),
    ]);
    const users = usersData.users || [];
    const chats = chatsData.chats || [];
    const online = onlineData.users || [];
    body.innerHTML = `
      <div class="profile-page-group profile-admin-panel">
        <h3>Overview</h3>
        <div class="profile-admin-stats">
          <article><b>${users.length}</b><small>Users</small></article>
          <article><b>${online.length}</b><small>Online</small></article>
          <article><b>${users.filter((user) => user.isBanned).length}</b><small>Banned</small></article>
          <article><b>${chats.length}</b><small>Chats</small></article>
        </div>
      </div>
      <div class="profile-page-group profile-admin-panel">
        <h3>Users</h3>
        <div class="profile-admin-list">
          ${users.map((user) => `<article><span><b>${escapeHtml(user.displayName || user.username || `User #${user.id}`)}</b><small>@${escapeHtml(user.username || '')} · ${escapeHtml(user.mobile || '—')} · ${escapeHtml(user.role || 'user')}</small></span><em>${user.isBanned ? 'banned' : 'active'}</em></article>`).join('') || '<p>No users.</p>'}
        </div>
      </div>
      <div class="profile-page-group profile-admin-panel">
        <h3>Online users</h3>
        <div class="profile-admin-list">
          ${online.map((user) => `<article><span><b>${escapeHtml(user.displayName || user.username || `User #${user.id}`)}</b><small>@${escapeHtml(user.username || '')}</small></span><em>online</em></article>`).join('') || '<p>No users online.</p>'}
        </div>
      </div>
      <div class="profile-page-group profile-admin-panel">
        <h3>Chats</h3>
        <div class="profile-admin-list">
          ${chats.map((chat) => `<article><span><b>${escapeHtml(chat.title || `${chat.type} chat #${chat.id}`)}</b><small>${escapeHtml(chat.type)} · owner #${escapeHtml(chat.ownerId ?? '—')}</small></span><em>›</em></article>`).join('') || '<p>No chats.</p>'}
        </div>
      </div>
    `;
  } catch (error) {
    body.innerHTML = `<div class="profile-page-group"><h3>Administration</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function injectAdminRow() {
  const profileContent = document.querySelector('.profile-screen .profile-page-content');
  if (!profileContent || profileContent.querySelector('[data-restored-admin-row]')) return;
  if (!profileContent.textContent.includes('Settings') && !profileContent.textContent.includes('Account')) return;

  const firstGroup = profileContent.querySelector('.profile-page-group');
  if (!firstGroup) return;
  if (firstGroup.textContent.includes('Administration')) return;

  const button = document.createElement('button');
  button.className = 'profile-page-row';
  button.type = 'button';
  button.dataset.restoredAdminRow = 'true';
  button.innerHTML = '<span class="profile-row-icon">🛡️</span><span><b>Administration</b><small>Users, chats and online sessions</small></span><em>›</em>';
  button.addEventListener('click', openAdminScreen);
  firstGroup.appendChild(button);
}

const observer = new MutationObserver(injectAdminRow);
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', injectAdminRow);
window.addEventListener('focus', injectAdminRow);
injectAdminRow();
