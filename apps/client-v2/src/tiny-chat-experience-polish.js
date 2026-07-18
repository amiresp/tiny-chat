import './tiny-chat-experience-polish.css';
import { api, assetUrl } from './api';

const SMILE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8"/><path d="M9 9.5h.01M15 9.5h.01"/></svg>';
const USERS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const PIN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 17 5 5M5 3l6.5 6.5M14 4l6 6-4 1-5 5-3-3 5-5 1-4ZM5 19l4-4"/></svg>';
const LINK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07.07l2-2A5 5 0 0 0 12 4l-1.15 1.15"/><path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15"/></svg>';
const MESSAGE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.7-5.1A7 7 0 0 1 3 12V8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7Z"/></svg>';

const SETTINGS_COPY = {
  profile: ['Your account', 'Keep your identity and profile details up to date across Tiny Chat.'],
  appearance: ['Appearance', 'Choose the visual mode that feels most comfortable on this device.'],
  privacy: ['Privacy controls', 'Control visibility, read receipts, and who can reach you.'],
  security: ['Security', 'Protect your account with a strong password and review sensitive access.'],
  sessions: ['Active sessions', 'Review devices signed in to your account and revoke access when needed.'],
  admin: ['Administration', 'Manage Tiny Chat conversations and destructive operations with care.'],
};

function currentChatId() {
  return Number(new URLSearchParams(location.search).get('chat') || 0) || null;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeEmojiButton() {
  const bar = document.querySelector('.composer-bar');
  if (!bar) return;

  let buttons = [...bar.querySelectorAll('.tiny-emoji-button')];
  if (!buttons.length) return;

  const keep = buttons[0];
  buttons.slice(1).forEach((button) => button.remove());

  if (keep.dataset.svgEmojiButton === '1') return;
  keep.dataset.svgEmojiButton = '1';
  keep.innerHTML = SMILE_ICON;
  keep.setAttribute('aria-label', 'Open emoji picker');
  keep.setAttribute('title', 'Emoji');
}

function activeSettingsTab(page) {
  const active = page.querySelector('.tiny-settings-nav button.active');
  return active?.dataset.settingsTab || (active?.hasAttribute('data-admin-chat-tab') ? 'admin' : 'profile');
}

function enhanceSettingsPage() {
  const page = document.querySelector('.tiny-settings-page');
  const content = page?.querySelector('.tiny-settings-content');
  if (!page || !content) return;

  const tab = activeSettingsTab(page);
  const [title, description] = SETTINGS_COPY[tab] || SETTINGS_COPY.profile;
  let hero = content.querySelector(':scope > .pm-settings-hero');
  if (!hero) {
    hero = document.createElement('section');
    hero.className = 'pm-settings-hero';
    content.prepend(hero);
  }

  const theme = localStorage.getItem('verdant-theme-mode') || 'system';
  hero.innerHTML = `
    <div class="pm-settings-hero-copy">
      <span>Settings</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
    </div>
    <div class="pm-settings-context">
      <span><b>${escapeHtml(theme[0].toUpperCase() + theme.slice(1))}</b><small>Theme</small></span>
      <span><b>Tiny Chat</b><small>Workspace</small></span>
    </div>
  `;

  content.querySelectorAll(':scope > .tiny-settings-panel').forEach((panel) => {
    panel.classList.add('pm-settings-panel');
    const heading = panel.querySelector(':scope > h2');
    if (heading && !panel.querySelector('.pm-panel-kicker')) {
      const kicker = document.createElement('span');
      kicker.className = 'pm-panel-kicker';
      kicker.textContent = tab === 'admin' ? 'Management' : 'Preferences';
      heading.before(kicker);
    }
  });
}

function memberAvatar(member) {
  const name = member.display_name || member.displayName || member.username || 'User';
  const src = assetUrl(member.avatar_url || member.avatarUrl);
  const initials = name.trim().slice(0, 2).toUpperCase();
  return `<span class="pm-member-avatar">${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(name)}">` : `<b>${escapeHtml(initials)}</b>`}</span>`;
}

function renderMembers(members = []) {
  if (!members.length) return '';
  return `
    <section class="pm-chat-info-section">
      <div class="pm-chat-info-section-head"><div>${USERS_ICON}<span><b>Members</b><small>${members.length} participant${members.length === 1 ? '' : 's'}</small></span></div></div>
      <div class="pm-member-list">
        ${members.map((member) => {
          const name = member.display_name || member.displayName || member.username || 'User';
          const username = member.username ? `@${member.username}` : 'Tiny Chat user';
          const role = member.role || 'member';
          return `<article>${memberAvatar(member)}<div><b>${escapeHtml(name)}</b><small>${escapeHtml(username)}</small></div><span>${escapeHtml(role)}</span></article>`;
        }).join('')}
      </div>
    </section>
  `;
}

function renderPinned(message) {
  if (!message) return '';
  const text = message.body || message.fileName || 'Pinned message';
  return `
    <section class="pm-chat-info-section">
      <div class="pm-chat-info-section-head"><div>${PIN_ICON}<span><b>Pinned message</b><small>Highlighted in this conversation</small></span></div></div>
      <div class="pm-pinned-preview">${escapeHtml(String(text).slice(0, 180))}</div>
    </section>
  `;
}

async function enhanceProfilePage() {
  const page = document.querySelector('.tiny-profile-page');
  const main = page?.querySelector('.tiny-page-main');
  const card = main?.querySelector('.tiny-profile-page-card');
  const chatId = currentChatId();
  if (!page || !main || !card || !chatId || page.dataset.pmChatInfoLoading === '1' || page.dataset.pmChatInfoDone === '1') return;

  page.dataset.pmChatInfoLoading = '1';
  try {
    const info = await api(`/api/v2/chats/${chatId}/info`);
    if (!document.body.contains(page)) return;

    const chat = info.chat || {};
    const members = info.members || [];
    const invites = (info.invites || []).filter((invite) => !invite.revoked_at && !invite.revokedAt);
    const pinned = info.pinnedMessage || info.pinned_message || null;

    card.classList.add('pm-profile-card');
    let extra = card.querySelector('.pm-chat-info-extra');
    if (!extra) {
      extra = document.createElement('div');
      extra.className = 'pm-chat-info-extra';
      card.appendChild(extra);
    }

    extra.innerHTML = `
      <section class="pm-chat-stats">
        <article>${MESSAGE_ICON}<div><b>${escapeHtml(String(chat.type || 'chat').replace(/^./, (c) => c.toUpperCase()))}</b><small>Conversation</small></div></article>
        <article>${USERS_ICON}<div><b>${members.length}</b><small>Members</small></div></article>
        <article>${PIN_ICON}<div><b>${pinned ? 'Yes' : 'No'}</b><small>Pinned</small></div></article>
        <article>${LINK_ICON}<div><b>${invites.length}</b><small>Active invites</small></div></article>
      </section>
      ${renderPinned(pinned)}
      ${renderMembers(members)}
    `;

    page.dataset.pmChatInfoDone = '1';
  } catch {
    // Base profile information remains usable when enhanced chat info is unavailable.
  } finally {
    delete page.dataset.pmChatInfoLoading;
  }
}

function polishDangerZone() {
  document.querySelectorAll('.tiny-profile-danger').forEach((section) => {
    section.classList.add('pm-danger-zone');
    const heading = section.querySelector('b');
    if (heading) heading.textContent = 'Danger zone';
  });
}

function runExperiencePass() {
  normalizeEmojiButton();
  enhanceSettingsPage();
  enhanceProfilePage();
  polishDangerZone();
}

let frame = 0;
const observer = new MutationObserver(() => {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    runExperiencePass();
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('popstate', () => requestAnimationFrame(runExperiencePass));
window.addEventListener('DOMContentLoaded', () => setTimeout(runExperiencePass, 300));
setTimeout(runExperiencePass, 900);
