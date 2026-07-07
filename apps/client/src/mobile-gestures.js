const EDGE_SIZE = 28;
const BACK_THRESHOLD = 82;
const MAX_VERTICAL_DRIFT = 58;
const MIN_HORIZONTAL_RATIO = 1.25;

let start = null;

function isMobileWidth() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function isInteractiveTarget(target) {
  return Boolean(target.closest([
    '.bubble',
    '.composer',
    '.conversation-menu',
    '.modal',
    '.account-menu-overlay',
    '.media-gallery-overlay',
    '.lightbox',
    'button',
    'a',
    'input',
    'textarea',
    'select',
  ].join(',')));
}

function hasOpenConversation() {
  const conversation = document.querySelector('.conversation:not(.mobile-hidden)');
  return Boolean(conversation && window.getComputedStyle(conversation).display !== 'none');
}

window.addEventListener('touchstart', (event) => {
  if (!isMobileWidth() || event.touches.length !== 1 || !hasOpenConversation()) {
    start = null;
    return;
  }

  if (isInteractiveTarget(event.target)) {
    start = null;
    return;
  }

  const touch = event.touches[0];
  const width = window.innerWidth;
  const fromLeft = touch.clientX <= EDGE_SIZE;
  const fromRight = touch.clientX >= width - EDGE_SIZE;

  if (!fromLeft && !fromRight) {
    start = null;
    return;
  }

  start = {
    x: touch.clientX,
    y: touch.clientY,
    edge: fromLeft ? 'left' : 'right',
    fired: false,
  };
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  if (!start || event.touches.length !== 1 || start.fired) return;

  const touch = event.touches[0];
  const deltaX = touch.clientX - start.x;
  const deltaY = touch.clientY - start.y;

  if (Math.abs(deltaY) > MAX_VERTICAL_DRIFT) {
    start = null;
    return;
  }

  const isBackSwipe = start.edge === 'left'
    ? deltaX > BACK_THRESHOLD
    : deltaX < -BACK_THRESHOLD;

  if (isBackSwipe && Math.abs(deltaX) > Math.abs(deltaY) * MIN_HORIZONTAL_RATIO) {
    start.fired = true;
    navigator.vibrate?.(8);
    document.querySelector('.mobile-back')?.click();
  }
}, { passive: true });

window.addEventListener('touchend', () => {
  start = null;
}, { passive: true });

window.addEventListener('touchcancel', () => {
  start = null;
}, { passive: true });
