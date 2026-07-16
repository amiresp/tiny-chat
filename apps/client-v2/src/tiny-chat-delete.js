import './tiny-chat-delete.css';
import { api } from './api';

const TRASH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>';
const SHIELD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>';

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

function showToast(message, type = 'success') {
  let node = document.querySelector('.tiny-delete-toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'tiny-delete-toast';
    document.body.appendChild(node);
  }
  node.className = `tiny-delete-toast ${type}`;
  node.textContent = message;
  requestAnimationFrame(() => node.classList.add('show'));
  clearTimeout(node._timer);
  node._timer = setTimeout(() => node.classList.remove('show'), 2600);
}

function confirmDelete({ title, text, actionLabel = 'Delete', permanent = false }) {
  return new Promise((resolve) => {
    document.querySelector('.tiny-confirm-layer')?.remove();
    const layer = document.createElement('div');
    layer.className = 'tiny-confirm-layer';
    layer.innerHTML = `
      <section class="tiny-confirm-card" role="alertdialog" aria-modal="true">
        <span class="tiny-confirm-icon">${TRASH_ICON}</span>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(text)}</p>
        ${permanent ? '<small>This action cannot be undone.</small>' : '<small>The chat remains available to other members.</small>'}
        <footer>
          <button type="button" data-cancel>Cancel</button>
          <button type="button" class="danger" data-confirm>${escapeHtml(actionLabel)}</button>
        </footer>
      </section>
    `;
    function done(value) {
      layer.remove();
      resolve(value);
    }
    layer.querySelector('[data-cancel]').addEventListener('click', () => done(false));
    layer.querySelector('[data-confirm]').addEventListener('click', () => done(true));
    layer.addEventListener('click', (event) => event.target === layer && done(false));
    document.body.appendChild(layer);
  });
}

async function deleteCurrentChat() {
  const chatId = currentChatId();
  if (!chatId) return;
  const accepted = await confirmDelete({
    title: 'Delete this chat?',
    text: 'This conversation will be removed from your chat list on this account.',
    actionLabel: 'Delete chat',
  });
  if (!accepted) return;

  try {
    await api(`/api/v2/chats/${chatId}`, { method: 'DELETE' });
    localStorage.removeItem('verdant-last-chat-id');
    const params = new URLSearchParams(location.search);
    params.delete('chat');
    params.set('view', 'chats');
    location.href = `${location.pathname}?${params.toString()}`;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function ensureChatHeaderDeleteButton() {
  const chatId = currentChatId();
  const toolbar = document.querySelector('.chat-room-page ion-header ion-toolbar');
  const buttons = toolbar?.querySelector('ion-buttons[slot="end"]');
  if (!chatId || !buttons || buttons.querySelector('.tiny-delete-chat-button')) return;

  const button = document.createElement('ion-button');
  button.className = 'tiny-delete-chat-button';
  button.setAttribute('aria-label', 'Delete chat');
  button.setAttribute('title', 'Delete chat');
  button.innerHTML = TRASH_ICON;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    deleteCurrentChat();
  });
  buttons.insertBefore(button, buttons.lastElementChild || null);
}

function ensureProfileDeleteAction() {
  const page = document.querySelector('.tiny-profile-page');
  const card = page?.querySelector('.tiny-profile-page-card');
  if (!card || card.querySelector('.tiny-profile-danger')) return;

  const danger = document.createElement('section');
  danger.className = 'tiny-profile-danger';
  danger.innerHTML = `
    <div><b>Delete chat</b><p>Remove this conversation from your chat list.</p></div>
    <button type="button">${TRASH_ICON}<span>Delete chat</span></button>
  `;
  danger.querySelector('button').addEventListener('click', deleteCurrentChat);
  card.appendChild(danger);
}

function adminChatCard(chat) {
  const title = chat.title || `${chat.type || 'chat'} #${chat.id}`;
  const updated = chat.updatedAt || chat.updated_at;
  return `
    <article class="tiny-admin-chat-card" data-chat-id="${chat.id}">
      <span class="tiny-admin-chat-type">${escapeHtml(String(chat.type || 'chat').toUpperCase())}</span>
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>Chat #${chat.id}${chat.ownerId || chat.owner_id ? ` · Owner #${chat.ownerId || chat.owner_id}` : ''}</p>
        <small>${updated ? `Updated ${escapeHtml(new Date(updated).toLocaleString())}` : 'No update information'}</small>
      </div>
      <button type="button" data-admin-delete>${TRASH_ICON}<span>Delete permanently</span></button>
    </article>
  `;
}

async function renderAdminChats(page) {
  const content = page.querySelector('.tiny-settings-content');
  if (!content) return;
  content.innerHTML = '<div class="tiny-admin-chat-loading"><span></span><span></span><span></span><p>Loading chats…</p></div>';

  try {
    const result = await api('/api/admin/chats');
    const chats = result.chats || [];
    content.innerHTML = `
      <section class="tiny-settings-panel tiny-admin-chats-panel">
        <header><div><h2>Chat management</h2><p>Permanently remove chats and their messages from Tiny Chat.</p></div><strong>${chats.length}</strong></header>
        <label class="tiny-admin-chat-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" placeholder="Search chats"></label>
        <div class="tiny-admin-chat-list">${chats.length ? chats.map(adminChatCard).join('') : '<div class="tiny-admin-chat-empty">No chats found.</div>'}</div>
      </section>
    `;

    const list = content.querySelector('.tiny-admin-chat-list');
    content.querySelector('input[type="search"]').addEventListener('input', (event) => {
      const query = event.target.value.trim().toLowerCase();
      list.querySelectorAll('.tiny-admin-chat-card').forEach((card) => {
        card.hidden = query && !card.textContent.toLowerCase().includes(query);
      });
    });

    list.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-admin-delete]');
      if (!button) return;
      const card = button.closest('[data-chat-id]');
      const chatId = Number(card.dataset.chatId);
      const title = card.querySelector('h3')?.textContent || `Chat #${chatId}`;
      const accepted = await confirmDelete({
        title: `Delete ${title}?`,
        text: 'The chat, messages, memberships and uploaded files will be permanently removed.',
        actionLabel: 'Delete permanently',
        permanent: true,
      });
      if (!accepted) return;

      button.disabled = true;
      try {
        await api(`/api/v2/admin/chats/${chatId}`, { method: 'DELETE' });
        card.remove();
        const count = content.querySelector('.tiny-admin-chats-panel header strong');
        if (count) count.textContent = String(Math.max(0, Number(count.textContent) - 1));
        showToast('Chat deleted permanently.');
        if (currentChatId() === chatId) {
          const params = new URLSearchParams(location.search);
          params.delete('chat');
          params.set('view', 'settings');
          history.replaceState({}, '', `${location.pathname}?${params.toString()}`);
        }
      } catch (error) {
        button.disabled = false;
        showToast(error.message, 'error');
      }
    });
  } catch (error) {
    content.innerHTML = `<section class="tiny-settings-panel"><h2>Admin panel unavailable</h2><p>${escapeHtml(error.message)}</p></section>`;
  }
}

async function ensureAdminSettingsTab() {
  const page = document.querySelector('.tiny-settings-page');
  const nav = page?.querySelector('.tiny-settings-nav');
  if (!page || !nav || nav.querySelector('[data-admin-chat-tab]')) return;

  try {
    const me = await api('/api/me');
    const role = String(me.user?.role || '').toLowerCase();
    if (!['admin', 'administrator', 'superadmin', 'owner'].includes(role)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.adminChatTab = 'true';
    button.innerHTML = `${SHIELD_ICON}<span>Admin</span>`;
    button.addEventListener('click', () => {
      nav.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
      renderAdminChats(page);
    });
    nav.appendChild(button);
  } catch {
    // Non-admin users should not see an admin navigation item.
  }
}

function refreshEnhancements() {
  ensureChatHeaderDeleteButton();
  ensureProfileDeleteAction();
  ensureAdminSettingsTab();
}

const observer = new MutationObserver(() => refreshEnhancements());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('popstate', () => setTimeout(refreshEnhancements, 120));
window.addEventListener('DOMContentLoaded', () => setTimeout(refreshEnhancements, 500));
setInterval(refreshEnhancements, 1500);
