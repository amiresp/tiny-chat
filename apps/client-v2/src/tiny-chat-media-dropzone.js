import './tiny-chat-media-dropzone.css';

const MEDIA_SELECTOR = '.message-media';
let dragDepth = 0;
let dropOverlay = null;
let mediaViewer = null;

function isChatRoomVisible() {
  const room = document.querySelector('.chat-room-page');
  if (!room) return false;
  const style = window.getComputedStyle(room);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function getChatFileInput() {
  const footer = document.querySelector('.chat-room-page .composer-footer');
  return footer?.querySelector('input[type="file"]') || null;
}

function canAcceptDrop(event) {
  return isChatRoomVisible() && Array.from(event.dataTransfer?.types || []).includes('Files') && Boolean(getChatFileInput());
}

function ensureDropOverlay() {
  if (dropOverlay) return dropOverlay;
  dropOverlay = document.createElement('div');
  dropOverlay.className = 'tiny-chat-drop-overlay';
  dropOverlay.setAttribute('aria-hidden', 'true');
  dropOverlay.innerHTML = `
    <div class="tiny-chat-drop-card">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>
      <strong>Drop to upload</strong>
      <span>Image, video or file</span>
    </div>`;
  document.body.appendChild(dropOverlay);
  return dropOverlay;
}

function showDropOverlay() {
  ensureDropOverlay().classList.add('is-visible');
}

function hideDropOverlay() {
  dragDepth = 0;
  dropOverlay?.classList.remove('is-visible');
}

function uploadDroppedFile(file) {
  const input = getChatFileInput();
  if (!input || !file) return;
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (error) {
    console.error('Tiny Chat drop upload failed', error);
  }
}

function ensureMediaViewer() {
  if (mediaViewer) return mediaViewer;
  mediaViewer = document.createElement('div');
  mediaViewer.className = 'tiny-chat-media-viewer';
  mediaViewer.setAttribute('role', 'dialog');
  mediaViewer.setAttribute('aria-modal', 'true');
  mediaViewer.setAttribute('aria-label', 'Media preview');
  mediaViewer.innerHTML = `
    <div class="tiny-chat-media-toolbar">
      <a class="tiny-chat-media-download" download target="_blank" rel="noreferrer" aria-label="Download media" title="Download">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M5 19h14"/></svg>
        <span>Download</span>
      </a>
      <button type="button" class="tiny-chat-media-close" aria-label="Close preview" title="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
    <div class="tiny-chat-media-stage"></div>`;
  document.body.appendChild(mediaViewer);

  const close = () => closeMediaViewer();
  mediaViewer.querySelector('.tiny-chat-media-close').addEventListener('click', close);
  mediaViewer.addEventListener('click', (event) => {
    if (event.target === mediaViewer || event.target.classList.contains('tiny-chat-media-stage')) close();
  });
  return mediaViewer;
}

function closeMediaViewer() {
  if (!mediaViewer) return;
  const video = mediaViewer.querySelector('video');
  if (video) video.pause();
  mediaViewer.classList.remove('is-open');
  mediaViewer.querySelector('.tiny-chat-media-stage').replaceChildren();
  document.body.classList.remove('tiny-chat-media-open');
}

function openMediaViewer(source) {
  const src = source.currentSrc || source.src;
  if (!src) return;
  const viewer = ensureMediaViewer();
  const stage = viewer.querySelector('.tiny-chat-media-stage');
  const download = viewer.querySelector('.tiny-chat-media-download');
  const isVideo = source.tagName === 'VIDEO';
  const media = document.createElement(isVideo ? 'video' : 'img');
  media.src = src;
  media.className = 'tiny-chat-media-large';
  if (isVideo) {
    media.controls = true;
    media.preload = 'metadata';
    media.playsInline = true;
  } else {
    media.alt = source.alt || 'Image preview';
  }
  stage.replaceChildren(media);
  download.href = src;
  download.download = source.getAttribute('data-file-name') || '';
  viewer.classList.add('is-open');
  document.body.classList.add('tiny-chat-media-open');
  viewer.querySelector('.tiny-chat-media-close').focus({ preventScroll: true });
}

document.addEventListener('dragenter', (event) => {
  if (!canAcceptDrop(event)) return;
  event.preventDefault();
  dragDepth += 1;
  showDropOverlay();
});

document.addEventListener('dragover', (event) => {
  if (!canAcceptDrop(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  showDropOverlay();
});

document.addEventListener('dragleave', (event) => {
  if (!dropOverlay?.classList.contains('is-visible')) return;
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) hideDropOverlay();
});

document.addEventListener('drop', (event) => {
  if (!canAcceptDrop(event)) return;
  event.preventDefault();
  event.stopPropagation();
  const file = event.dataTransfer?.files?.[0];
  hideDropOverlay();
  if (file) uploadDroppedFile(file);
});

document.addEventListener('click', (event) => {
  const media = event.target.closest?.(MEDIA_SELECTOR);
  if (!media || !media.closest('.message-bubble')) return;
  event.preventDefault();
  event.stopPropagation();
  openMediaViewer(media);
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideDropOverlay();
    closeMediaViewer();
  }
});
