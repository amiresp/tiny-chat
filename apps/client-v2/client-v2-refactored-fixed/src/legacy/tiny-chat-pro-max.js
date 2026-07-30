import './tiny-chat-pro-max.css';

const SELECTORS = {
  page: '.tiny-real-page',
  rail: '.tiny-navigation-rail',
  mobileNav: '.tiny-mobile-nav',
  settingsNav: '.tiny-settings-nav',
};

function labelIconButtons(root = document) {
  root.querySelectorAll('button,ion-button').forEach((button) => {
    if (button.getAttribute('aria-label')) return;
    const text = button.textContent?.trim();
    const title = button.getAttribute('title');
    if (title) button.setAttribute('aria-label', title);
    else if (text) button.setAttribute('aria-label', text.slice(0, 80));
  });
}

function normalizeNavigationState() {
  const view = new URLSearchParams(location.search).get('view') || 'chats';
  const mapping = { chats: 'chats', chat: 'chats', profile: 'chats', contacts: 'contacts', settings: 'settings' };
  const active = mapping[view] || 'chats';
  document.querySelectorAll(`${SELECTORS.rail} [data-action],${SELECTORS.mobileNav} [data-action]`).forEach((item) => {
    const selected = item.dataset.action === active;
    item.classList.toggle('active', selected);
    if (selected) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
}

function dedupeAdminNavigation() {
  const nav = document.querySelector(SELECTORS.settingsNav);
  if (!nav) return;
  const buttons = [...nav.querySelectorAll('button')].filter((button) => button.textContent?.trim().toLowerCase() === 'admin' || button.hasAttribute('data-admin-chat-tab'));
  buttons.slice(1).forEach((button) => button.remove());
}

function improveRealPageAccessibility() {
  const page = document.querySelector(SELECTORS.page);
  if (!page || page.dataset.pmA11y === '1') return;
  page.dataset.pmA11y = '1';
  page.setAttribute('role', 'main');
  page.setAttribute('tabindex', '-1');
  const heading = page.querySelector('h1');
  if (heading && !heading.id) heading.id = `tiny-page-title-${Date.now()}`;
  if (heading?.id) page.setAttribute('aria-labelledby', heading.id);
  requestAnimationFrame(() => page.focus({ preventScroll: true }));
}

function improveLiveRegions() {
  document.querySelectorAll('.tiny-delete-toast,.center-note').forEach((node) => {
    if (!node.getAttribute('aria-live')) node.setAttribute('aria-live', 'polite');
  });
  document.querySelectorAll('.typing-indicator').forEach((node) => {
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
  });
}

function ensureModalEscapeLabels() {
  document.querySelectorAll('ion-modal ion-button,ion-action-sheet button').forEach((button) => {
    const text = button.textContent?.trim();
    if (!button.getAttribute('aria-label') && text) button.setAttribute('aria-label', text);
  });
}

function applyProMaxPass() {
  document.documentElement.dataset.designSystem = 'tiny-chat-pro-max';
  labelIconButtons();
  normalizeNavigationState();
  dedupeAdminNavigation();
  improveRealPageAccessibility();
  improveLiveRegions();
  ensureModalEscapeLabels();
}

let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    applyProMaxPass();
  });
});

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('popstate', () => requestAnimationFrame(applyProMaxPass));
window.addEventListener('resize', () => requestAnimationFrame(applyProMaxPass), { passive: true });
window.addEventListener('DOMContentLoaded', applyProMaxPass);
setTimeout(applyProMaxPass, 300);
