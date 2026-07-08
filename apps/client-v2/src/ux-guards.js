import './ux-guards.css';
import { apiOrigin } from './runtime';

let activeChatId = null;
const originalFetch = window.fetch.bind(window);

window.fetch = async (...args) => {
  const raw = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  const match = String(raw).match(/\/api\/(?:v2\/)?chats\/(\d+)\//);
  if (match) activeChatId = Number(match[1]);
  return originalFetch(...args);
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
    if (seen.has(id) || /Message deleted/i.test(text)) {
      node.remove();
      return;
    }
    seen.add(id);
  });
}

const observer = new MutationObserver(cleanupMessages);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('focus', cleanupMessages);
setInterval(cleanupMessages, 1800);

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
