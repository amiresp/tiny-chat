const EDGE_SIZE = 30;
const BACK_THRESHOLD = 92;
const TAB_THRESHOLD = 72;
const MAX_VERTICAL_DRIFT = 58;
const MIN_HORIZONTAL_RATIO = 1.25;
const EXIT_MS = 220;

let edgeSwipe = null;
let tabSwipe = null;
let completingBack = false;

function isMobileWidth() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function conversationElement() {
  const conversation = document.querySelector('.conversation:not(.mobile-hidden)');
  return conversation && window.getComputedStyle(conversation).display !== 'none'
    ? conversation
    : null;
}

function isInteractiveTarget(target) {
  return Boolean(target.closest([
    '.bubble',
    '.composer',
    '.conversation-menu',
    '.modal',
    '.account-menu-overlay',
    '.profile-page-overlay',
    '.media-gallery-overlay',
    '.lightbox',
    'button',
    'a',
    'input',
    'textarea',
    'select',
  ].join(',')));
}

function setConversationSwipe(value, edge) {
  const conversation = conversationElement();
  if (!conversation) return;
  conversation.classList.add('edge-swiping');
  conversation.dataset.edge = edge;
  conversation.style.setProperty('--edge-swipe', `${value}px`);
}

function resetConversationSwipe() {
  const conversation = document.querySelector('.conversation.edge-swiping, .conversation.edge-completing, .conversation.edge-source-hidden');
  if (!conversation) return;
  conversation.classList.remove('edge-swiping', 'edge-completing', 'edge-source-hidden');
  conversation.style.removeProperty('--edge-swipe');
  delete conversation.dataset.edge;
}

function completeConversationSwipe(edge, startDistance = 0) {
  const conversation = conversationElement();
  if (!conversation || completingBack) return;

  completingBack = true;
  conversation.classList.remove('edge-swiping');
  conversation.classList.add('edge-completing');
  conversation.dataset.edge = edge;
  conversation.style.setProperty('--edge-swipe', `${Math.max(startDistance, BACK_THRESHOLD)}px`);
  navigator.vibrate?.(8);

  window.setTimeout(() => {
    const button = document.querySelector('.mobile-back');
    button?.click();
    completingBack = false;
    window.setTimeout(resetConversationSwipe, 40);
  }, EXIT_MS);
}

function activeTabIndex() {
  const buttons = [...document.querySelectorAll('.chat-state-tabs button')];
  const active = buttons.findIndex((button) => button.classList.contains('active'));
  return { buttons, active };
}

function setTabSwipe(value) {
  const sidebar = document.querySelector('.sidebar:not(.mobile-hidden)');
  if (!sidebar) return;
  sidebar.classList.add('tab-swiping');
  sidebar.style.setProperty('--tab-swipe', `${value}px`);
}

function resetTabSwipe() {
  const sidebar = document.querySelector('.sidebar.tab-swiping, .sidebar.tab-switching');
  if (!sidebar) return;
  sidebar.classList.remove('tab-swiping', 'tab-switching');
  sidebar.style.removeProperty('--tab-swipe');
}

function switchTab(direction) {
  const { buttons, active } = activeTabIndex();
  if (buttons.length < 2 || active < 0) return false;

  const next = direction === 'left' ? 1 : 0;
  if (next === active || !buttons[next]) return false;

  const sidebar = document.querySelector('.sidebar:not(.mobile-hidden)');
  sidebar?.classList.add('tab-switching');
  buttons[next].click();
  navigator.vibrate?.(6);
  window.setTimeout(resetTabSwipe, 180);
  return true;
}

window.addEventListener('touchstart', (event) => {
  edgeSwipe = null;
  tabSwipe = null;

  if (!isMobileWidth() || event.touches.length !== 1 || completingBack) return;

  const touch = event.touches[0];
  const width = window.innerWidth;

  if (conversationElement() && !isInteractiveTarget(event.target)) {
    const fromLeft = touch.clientX <= EDGE_SIZE;
    const fromRight = touch.clientX >= width - EDGE_SIZE;

    if (fromLeft || fromRight) {
      edgeSwipe = {
        x: touch.clientX,
        y: touch.clientY,
        edge: fromLeft ? 'left' : 'right',
        active: false,
      };
      return;
    }
  }

  const chatList = event.target.closest?.('.chat-list');
  if (chatList && !event.target.closest('button')) {
    tabSwipe = {
      x: touch.clientX,
      y: touch.clientY,
      active: false,
    };
  }
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  if (!isMobileWidth() || event.touches.length !== 1 || completingBack) return;

  const touch = event.touches[0];

  if (edgeSwipe) {
    const deltaX = touch.clientX - edgeSwipe.x;
    const deltaY = touch.clientY - edgeSwipe.y;
    const effective = edgeSwipe.edge === 'left' ? deltaX : -deltaX;

    if (!edgeSwipe.active) {
      if (Math.abs(deltaY) > MAX_VERTICAL_DRIFT || Math.abs(deltaY) > Math.abs(deltaX)) {
        edgeSwipe = null;
        resetConversationSwipe();
        return;
      }
      if (effective > 12 && effective > Math.abs(deltaY) * MIN_HORIZONTAL_RATIO) {
        edgeSwipe.active = true;
      }
    }

    if (!edgeSwipe?.active) return;
    event.preventDefault();
    const distance = Math.max(0, Math.min(window.innerWidth, effective));
    setConversationSwipe(distance, edgeSwipe.edge);
    return;
  }

  if (tabSwipe) {
    const deltaX = touch.clientX - tabSwipe.x;
    const deltaY = touch.clientY - tabSwipe.y;

    if (!tabSwipe.active) {
      if (Math.abs(deltaY) > 22 && Math.abs(deltaY) > Math.abs(deltaX)) {
        tabSwipe = null;
        resetTabSwipe();
        return;
      }
      if (Math.abs(deltaX) > 14 && Math.abs(deltaX) > Math.abs(deltaY) * MIN_HORIZONTAL_RATIO) {
        tabSwipe.active = true;
      }
    }

    if (!tabSwipe?.active) return;
    event.preventDefault();
    setTabSwipe(Math.max(-90, Math.min(90, deltaX)));
  }
}, { passive: false });

window.addEventListener('touchend', () => {
  if (edgeSwipe) {
    const conversation = document.querySelector('.conversation.edge-swiping');
    const value = Math.abs(Number.parseFloat(conversation?.style.getPropertyValue('--edge-swipe') || '0'));
    const edge = edgeSwipe.edge;
    const shouldBack = edgeSwipe.active && value >= BACK_THRESHOLD;
    edgeSwipe = null;

    if (shouldBack) completeConversationSwipe(edge, value);
    else resetConversationSwipe();
  }

  if (tabSwipe) {
    const sidebar = document.querySelector('.sidebar.tab-swiping');
    const value = Number.parseFloat(sidebar?.style.getPropertyValue('--tab-swipe') || '0');
    const shouldSwitch = tabSwipe.active && Math.abs(value) >= TAB_THRESHOLD;
    const direction = value < 0 ? 'left' : 'right';
    tabSwipe = null;

    if (!shouldSwitch || !switchTab(direction)) resetTabSwipe();
  }
}, { passive: true });

window.addEventListener('touchcancel', () => {
  edgeSwipe = null;
  tabSwipe = null;
  completingBack = false;
  resetConversationSwipe();
  resetTabSwipe();
}, { passive: true });
