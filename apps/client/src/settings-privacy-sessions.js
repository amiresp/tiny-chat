import { apiOrigin } from './runtime';

const token = () => localStorage.getItem('verdant-token');

async function api(path, options = {}) {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || 'Request failed.');
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function sidebar() {
  return document.querySelector('.sidebar.profile-mode, .sidebar:not(.mobile-hidden), .sidebar');
}

function closeInternalScreen() {
  document.querySelector('.settings-subscreen')?.remove();
}

function openInternalScreen(title, subtitle) {
  closeInternalScreen();
  const host = sidebar();
  if (!host) return null;
  const screen = document.createElement('section');
  screen.className = 'profile-screen settings-subscreen slide-forward';
  screen.innerHTML = `
    <div class="profile-nav">
      <button class="profile-back" type="button">‹</button>
      <span><b>${escapeHtml(title)}</b><small>${escapeHtml(subtitle)}</small></span>
    </div>
    <div class="profile-page-content"><div class="profile-admin-loading">Loading…</div></div>
  `;
  screen.querySelector('.profile-back')?.addEventListener('click', closeInternalScreen);
  host.appendChild(screen);
  return screen.querySelector('.profile-page-content');
}

async function openSessions() {
  const body = openInternalScreen('Sessions', 'Manage active logins');
  if (!body) return;
  try {
    const data = await api('/api/v2/sessions');
    body.innerHTML = `
      <div class="profile-page-group profile-admin-panel">
        <h3>Active sessions</h3>
        <div class="profile-admin-list">
          ${(data.sessions || []).map((session) => `
            <article>
              <span><b>${escapeHtml(session.id.slice(0, 10))}</b><small>Last used: ${escapeHtml(new Date(session.last_used_at).toLocaleString())}</small></span>
              <button class="profile-admin-danger" data-session="${escapeHtml(session.id)}">Logout</button>
            </article>
          `).join('') || '<p>No active sessions.</p>'}
        </div>
      </div>
    `;
    body.querySelectorAll('[data-session]').forEach((button) => {
      button.addEventListener('click', async () => {
        await api(`/api/v2/sessions/${button.dataset.session}`, { method: 'DELETE' });
        button.closest('article')?.remove();
      });
    });
  } catch (error) {
    body.innerHTML = `<div class="profile-page-group"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function openPrivacy() {
  const body = openInternalScreen('Privacy', 'Last seen, receipts and blocked users');
  if (!body) return;
  try {
    const data = await api('/api/v2/privacy');
    body.innerHTML = `
      <div class="profile-page-group">
        <h3>Privacy</h3>
        <form class="profile-form" data-privacy-form>
          <label class="profile-check"><input name="readReceipts" type="checkbox" ${data.privacy.read_receipts ? 'checked' : ''}><span><b>Read receipts</b><small>Let others know when you read messages.</small></span></label>
          <label>Last seen<select name="lastSeen"><option value="everyone">Everyone</option><option value="nobody">Nobody</option></select></label>
          <label>Who can message me<select name="allowMessages"><option value="everyone">Everyone</option><option value="contacts">Contacts</option></select></label>
          <button class="profile-submit" type="submit">Save privacy</button>
        </form>
      </div>
      <div class="profile-page-group profile-admin-panel">
        <h3>Blocked users</h3>
        <div class="profile-admin-list">
          ${(data.blocked || []).map((user) => `<article><span><b>${escapeHtml(user.display_name || user.username)}</b><small>@${escapeHtml(user.username || '')}</small></span><button class="profile-admin-positive" data-unblock="${user.id}">Unblock</button></article>`).join('') || '<p>No blocked users.</p>'}
        </div>
      </div>
    `;
    body.querySelector('[name="lastSeen"]').value = data.privacy.last_seen || 'everyone';
    body.querySelector('[name="allowMessages"]').value = data.privacy.allow_messages || 'everyone';
    body.querySelector('[data-privacy-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await api('/api/v2/privacy', {
        method: 'PATCH',
        body: JSON.stringify({
          readReceipts: Boolean(form.get('readReceipts')),
          lastSeen: form.get('lastSeen'),
          allowMessages: form.get('allowMessages'),
        }),
      });
      alert('Privacy saved.');
    });
    body.querySelectorAll('[data-unblock]').forEach((button) => {
      button.addEventListener('click', async () => {
        await api(`/api/v2/users/${button.dataset.unblock}/block`, { method: 'DELETE' });
        button.closest('article')?.remove();
      });
    });
  } catch (error) {
    body.innerHTML = `<div class="profile-page-group"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function makeRow({ icon, title, subtitle, action }) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'profile-page-row settings-extra-row';
  row.innerHTML = `<span class="profile-row-icon">${icon}</span><span><b>${escapeHtml(title)}</b><small>${escapeHtml(subtitle)}</small></span><em>›</em>`;
  row.addEventListener('click', action);
  return row;
}

function injectSettingsRows() {
  const screen = document.querySelector('.profile-screen:not(.settings-subscreen)');
  if (!screen || !screen.textContent.includes('Settings') || !screen.textContent.includes('Appearance')) return;
  const content = screen.querySelector('.profile-page-content');
  if (!content || content.querySelector('[data-settings-security-group]')) return;

  const group = document.createElement('div');
  group.className = 'profile-page-group';
  group.dataset.settingsSecurityGroup = 'true';
  group.innerHTML = '<h3>Account</h3>';
  group.append(
    makeRow({ icon: '🔐', title: 'Privacy', subtitle: 'Last seen, read receipts and blocked users', action: openPrivacy }),
    makeRow({ icon: '💻', title: 'Sessions', subtitle: 'Manage logged-in devices', action: openSessions }),
  );
  content.appendChild(group);
}

const observer = new MutationObserver(injectSettingsRows);
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', injectSettingsRows);
window.addEventListener('focus', injectSettingsRows);
injectSettingsRows();
