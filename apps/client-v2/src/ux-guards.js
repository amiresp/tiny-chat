import './ux-guards.css';
import { apiOrigin } from './runtime';

let activeChatId = null;
let latestChats = [];
let restoreAttempts = 0;
const originalFetch = window.fetch.bind(window);

function setRouteState(next = {}) {
  const params = new URLSearchParams(window.location.search);
  if (next.chat) {
    params.set('chat', String(next.chat));
    localStorage.setItem('verdant-last-chat-id', String(next.chat));
  }
  if (next.view) params.set('view', String(next.view));
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(window.history.state, '', url);
  }
}

function wantedChatId() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get('chat') || localStorage.getItem('verdant-last-chat-id') || 0) || null;
}

function safeCloneJson(response) {
  try {
    return response.clone().json().catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

function showErrorFallback(error) {
  if (document.querySelector('.ux-error-fallback')) return;
  const layer = document.createElement('div');
  layer.className = 'ux-error-fallback';
  layer.innerHTML = `
    <section class="ux-error-card">
      <h2>Something went wrong</h2>
      <p>The app recovered your last chat in the URL. Reload the page to continue from the same place.</p>
      <small>${String(error?.message || error || 'Unknown error').slice(0, 180)}</small>
      <button type="button">Reload app</button>
    </section>
  `;
  layer.querySelector('button').addEventListener('click', () => window.location.reload());
  document.body.appendChild(layer);
}

window.addEventListener('error', (event) => showErrorFallback(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => showErrorFallback(event.reason));

window.fetch = async (...args) => {
  const raw = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  const method = String(args[1]?.method || args[0]?.method || 'GET').toUpperCase();
  const url = String(raw);
  const chatMatch = url.match(/\/api\/(?:v2\/)?chats\/(\d+)\//);
  if (chatMatch) {
    activeChatId = Number(chatMatch[1]);
    setRouteState({ chat: activeChatId, view: 'chat' });
  }

  const response = await originalFetch(...args);

  if (/\/api\/v2\/chats(?:\?|$)/.test(url) && method === 'GET') {
    safeCloneJson(response).then((data) => {
      latestChats = Array.isArray(data?.chats) ? data.chats : [];
      if (latestChats.length) localStorage.setItem('verdant-chat-cache', JSON.stringify(latestChats.map((chat) => ({ id: chat.id, title: chat.title }))));
      restoreChatFromUrl();
    });
  }

  if (/\/api\/v2\/messages\/\d+/.test(url) && method === 'DELETE') {
    setTimeout(cleanupMessages, 120);
    setTimeout(cleanupMessages, 600);
  }

  return response;
};

function toast(message) {
  let node = document.querySelector('.ux-toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'ux-toast';
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(node._timer);
  node._timer = setTimeout(() => node.classList.remove('show'), 2400);
}

function cleanupMessages() {
  const seen = new Set();
  document.querySelectorAll('[data-message-id]').forEach((node) => {
    const id = node.getAttribute('data-message-id');
    if (!id || id === 'undefined' || id === 'null') return;
    const text = node.textContent || '';
    const shouldHide = seen.has(id) || /Message deleted/i.test(text);
    if (shouldHide) {
      node.classList.add('ux-hidden-message');
      node.setAttribute('aria-hidden', 'true');
      return;
    }
    seen.add(id);
    node.classList.remove('ux-hidden-message');
    node.removeAttribute('aria-hidden');
  });
}

const observer = new MutationObserver(cleanupMessages);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('focus', cleanupMessages);
setInterval(cleanupMessages, 1800);

function cachedChats() {
  if (latestChats.length) return latestChats;
  try {
    return JSON.parse(localStorage.getItem('verdant-chat-cache') || '[]');
  } catch {
    return [];
  }
}

function restoreChatFromUrl() {
  const chatId = wantedChatId();
  if (!chatId || activeChatId === chatId) return;
  const chat = cachedChats().find((item) => Number(item.id) === Number(chatId));
  if (!chat?.title) return;
  const rows = [...document.querySelectorAll('.chat-row')];
  const row = rows.find((item) => (item.textContent || '').includes(chat.title));
  if (row) {
    activeChatId = chatId;
    setRouteState({ chat: chatId, view: 'chat' });
    row.click();
    return;
  }
  if (restoreAttempts < 30) {
    restoreAttempts += 1;
    setTimeout(restoreChatFromUrl, 350);
  }
}

window.addEventListener('DOMContentLoaded', () => setTimeout(restoreChatFromUrl, 700));
window.addEventListener('popstate', () => setTimeout(restoreChatFromUrl, 120));

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function closePreview() {
  document.querySelector('.attachment-preview-layer')?.remove();
}

function showAttachmentPreview(input, file) {
  closePreview();
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const url = isImage || isVideo ? URL.createObjectURL(file) : '';
  const layer = document.createElement('div');
  layer.className = 'attachment-preview-layer';
  layer.innerHTML = `
    <section class="attachment-preview-card" role="dialog" aria-modal="true">
      <header>
        <strong>Preview attachment</strong>
        <button type="button" data-close aria-label="Close">×</button>
      </header>
      <div class="attachment-preview-body">
        ${isImage ? `<img src="${url}" alt="${file.name.replace(/"/g, '&quot;')}" />` : ''}
        ${isVideo ? `<video src="${url}" controls preload="metadata"></video>` : ''}
        ${!isImage && !isVideo ? `<div class="attachment-file-icon">📎</div>` : ''}
        <div class="attachment-file-meta">
          <b>${file.name}</b>
          <small>${file.type || 'file'} · ${formatSize(file.size)}</small>
        </div>
      </div>
      <footer>
        <button type="button" class="secondary" data-cancel>Cancel</button>
        <button type="button" class="primary" data-send>Send attachment</button>
      </footer>
    </section>
  `;
  document.body.appendChild(layer);

  function destroy(clear = false) {
    if (url) URL.revokeObjectURL(url);
    if (clear) input.value = '';
    closePreview();
  }

  layer.querySelector('[data-close]').addEventListener('click', () => destroy(true));
  layer.querySelector('[data-cancel]').addEventListener('click', () => destroy(true));
  layer.addEventListener('click', (event) => {
    if (event.target === layer) destroy(true);
  });
  layer.querySelector('[data-send]').addEventListener('click', () => {
    input.dataset.previewApproved = '1';
    destroy(false);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

document.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
  if (!input.closest('.chat-room-page')) return;
  if (input.dataset.previewApproved === '1') {
    delete input.dataset.previewApproved;
    return;
  }
  const file = input.files?.[0];
  if (!file) return;
  if (!activeChatId) {
    toast('Open a chat before attaching a file.');
    input.value = '';
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  showAttachmentPreview(input, file);
}, true);
