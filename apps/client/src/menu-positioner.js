const GAP = 10;
const MOBILE_QUERY = '(max-width: 760px)';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function triggerButton() {
  return document.querySelector('.conversation-actions > button');
}

function closeOpenMenu() {
  const menu = document.querySelector('.conversation-menu');
  if (!menu) return;
  triggerButton()?.click();
}

function positionMenu(menu) {
  if (!menu || menu.dataset.positioned === 'working') return;
  const trigger = triggerButton();
  if (!trigger) return;

  menu.dataset.positioned = 'working';

  const mobile = window.matchMedia(MOBILE_QUERY).matches;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const triggerRect = trigger.getBoundingClientRect();

  menu.style.position = 'fixed';
  menu.style.zIndex = '600';
  menu.style.maxHeight = `${Math.max(180, viewportHeight - triggerRect.bottom - GAP * 2)}px`;
  menu.style.overflowY = 'auto';
  menu.style.overscrollBehavior = 'contain';

  const measured = menu.getBoundingClientRect();
  const desiredWidth = mobile ? 252 : 218;
  const width = Math.min(desiredWidth, viewportWidth - GAP * 2);
  const height = measured.height || 320;
  const left = clamp(triggerRect.right - width, GAP, viewportWidth - width - GAP);
  const top = clamp(triggerRect.bottom + GAP, GAP, Math.max(GAP, viewportHeight - Math.min(height, viewportHeight - GAP * 2) - GAP));

  menu.style.width = `${width}px`;
  menu.style.left = `${left}px`;
  menu.style.right = 'auto';
  menu.style.top = `${top}px`;
  menu.style.transformOrigin = left + width / 2 > viewportWidth / 2 ? 'top right' : 'top left';
  menu.dataset.positioned = 'done';
}

function positionAllMenus() {
  document.querySelectorAll('.conversation-menu').forEach(positionMenu);
}

const observer = new MutationObserver(positionAllMenus);
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener('pointerdown', (event) => {
  const menu = document.querySelector('.conversation-menu');
  if (!menu) return;
  if (event.target.closest('.conversation-menu') || event.target.closest('.conversation-actions')) return;
  closeOpenMenu();
}, true);

window.addEventListener('resize', positionAllMenus);
window.addEventListener('orientationchange', () => window.setTimeout(positionAllMenus, 120));
document.addEventListener('scroll', positionAllMenus, true);
document.addEventListener('DOMContentLoaded', positionAllMenus);
