import './platform-ui.css';

const root = document.documentElement;
const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isElectron = /Electron/i.test(navigator.userAgent);
const isWindows = /Windows/i.test(navigator.userAgent);
const isDesktop = window.matchMedia?.('(min-width: 1024px)').matches;
let deferredInstallPrompt = null;
let startupTimer = null;

root.classList.toggle('is-pwa', Boolean(isStandalone));
root.classList.toggle('is-electron', Boolean(isElectron));
root.classList.toggle('is-windows', Boolean(isWindows));
root.classList.toggle('is-desktop', Boolean(isDesktop));
root.classList.toggle('is-browser', !isStandalone && !isElectron);
root.dataset.surface = isElectron ? 'windows' : isStandalone ? 'pwa' : 'browser';

function refreshDesktopClass() {
  const wide = window.innerWidth >= 1360;
  root.classList.toggle('is-desktop', window.innerWidth >= 1024);
  root.classList.toggle('is-wide-desktop', wide);
  const rail = document.querySelector('.desktop-helper-rail');
  if (rail && !wide) rail.remove();
  if (wide) setTimeout(ensureDesktopRail, 80);
}
window.addEventListener('resize', refreshDesktopClass, { passive: true });
refreshDesktopClass();

function clickFirst(selector) {
  const node = document.querySelector(selector);
  if (node instanceof HTMLElement) node.click();
  return Boolean(node);
}

function focusSearch() {
  const activeSearch = document.querySelector('.chat-list-page ion-searchbar input, ion-searchbar input');
  if (activeSearch instanceof HTMLElement) {
    activeSearch.focus();
    activeSearch.select?.();
    return true;
  }
  return false;
}

function openNewChat() {
  const buttons = [...document.querySelectorAll('.chat-list-page ion-header ion-toolbar:first-of-type ion-buttons ion-button')];
  const plusButton = buttons[buttons.length - 1];
  if (plusButton instanceof HTMLElement) {
    plusButton.click();
    return true;
  }
  return clickFirst('ion-fab-button');
}

function dismissLayer(layer) {
  if (!layer) return false;
  if (typeof layer.dismiss === 'function') {
    layer.dismiss();
    return true;
  }
  if (layer instanceof HTMLElement) {
    layer.remove();
    return true;
  }
  return false;
}

function closeTopLayer() {
  return dismissLayer(document.querySelector('.attachment-preview-layer'))
    || dismissLayer(document.querySelector('ion-action-sheet.show-action-sheet'))
    || dismissLayer(document.querySelector('ion-alert.alert-presenting'))
    || dismissLayer(document.querySelector('ion-modal.show-modal'))
    || false;
}

function showShortcutHelp() {
  document.querySelector('.desktop-shortcuts-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'desktop-shortcuts-layer';
  layer.innerHTML = `
    <section class="desktop-shortcuts-card">
      <header><strong>Keyboard shortcuts</strong><button type="button" aria-label="Close">×</button></header>
      <dl>
        <div><dt>Ctrl / Cmd + K</dt><dd>Search chats</dd></div>
        <div><dt>Ctrl / Cmd + N</dt><dd>New chat</dd></div>
        <div><dt>Esc</dt><dd>Close modal or preview</dd></div>
        <div><dt>Shift + Enter</dt><dd>New line in composer</dd></div>
        <div><dt>Enter</dt><dd>Send message</dd></div>
      </dl>
    </section>
  `;
  layer.querySelector('button').addEventListener('click', () => layer.remove());
  layer.addEventListener('click', (event) => {
    if (event.target === layer) layer.remove();
  });
  document.body.appendChild(layer);
}

window.addEventListener('keydown', (event) => {
  const key = String(event.key || '').toLowerCase();
  const mod = event.ctrlKey || event.metaKey;
  if (event.key === 'Escape') {
    if (closeTopLayer()) event.preventDefault();
    return;
  }
  if (!mod) return;
  if (key === 'k') {
    event.preventDefault();
    focusSearch();
  }
  if (key === 'n') {
    event.preventDefault();
    openNewChat();
  }
  if (key === '/' || key === '?') {
    event.preventDefault();
    showShortcutHelp();
  }
});

function runStartupAction() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  if (!action) return;
  let tries = 0;
  clearInterval(startupTimer);
  startupTimer = window.setInterval(() => {
    tries += 1;
    if (action === 'new-chat' && openNewChat()) window.clearInterval(startupTimer);
    if (action === 'search' && focusSearch()) window.clearInterval(startupTimer);
    if (tries > 12) window.clearInterval(startupTimer);
  }, 450);
}
window.addEventListener('DOMContentLoaded', runStartupAction);

function ensureDesktopRail() {
  if (!root.classList.contains('is-wide-desktop')) return;
  if (document.querySelector('.desktop-helper-rail')) return;
  const rail = document.createElement('aside');
  rail.className = 'desktop-helper-rail';
  rail.innerHTML = `
    <b>Desktop</b>
    <button type="button" data-shortcuts>Shortcuts</button>
    <button type="button" data-search>Search</button>
    <small>Ctrl+K search · Ctrl+N new chat</small>
  `;
  rail.querySelector('[data-shortcuts]').addEventListener('click', showShortcutHelp);
  rail.querySelector('[data-search]').addEventListener('click', focusSearch);
  document.body.appendChild(rail);
}
setTimeout(ensureDesktopRail, 900);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  showInstallPrompt();
});

function showInstallPrompt() {
  if (!deferredInstallPrompt || isStandalone || isElectron || document.querySelector('.pwa-install-card')) return;
  const card = document.createElement('div');
  card.className = 'pwa-install-card';
  card.innerHTML = `
    <div><b>Install Verdant Chat</b><small>Open it like a desktop app and keep your chat state.</small></div>
    <button type="button" data-install>Install</button>
    <button type="button" data-close aria-label="Close">×</button>
  `;
  card.querySelector('[data-install]').addEventListener('click', async () => {
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    card.remove();
    await prompt.prompt();
  });
  card.querySelector('[data-close]').addEventListener('click', () => card.remove());
  document.body.appendChild(card);
}

function showNetworkState(online) {
  let node = document.querySelector('.network-state-card');
  if (!node) {
    node = document.createElement('div');
    node.className = 'network-state-card';
    document.body.appendChild(node);
  }
  node.textContent = online ? 'Back online' : 'You are offline. Messages may fail until connection returns.';
  node.classList.toggle('offline', !online);
  node.classList.add('show');
  clearTimeout(node._timer);
  node._timer = setTimeout(() => node.classList.remove('show'), online ? 1600 : 3600);
}
window.addEventListener('online', () => showNetworkState(true));
window.addEventListener('offline', () => showNetworkState(false));

if (isStandalone) {
  root.classList.add('standalone-ready');
}
