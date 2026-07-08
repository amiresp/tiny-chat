let locked = false;
const EXIT_MS = 220;

function isMobile() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function animateBack(button) {
  if (locked || !isMobile()) return false;

  const conversation = document.querySelector('.conversation:not(.mobile-hidden)');
  if (!conversation || conversation.classList.contains('edge-swiping') || conversation.classList.contains('edge-completing')) return false;

  locked = true;
  conversation.classList.add('edge-completing');
  conversation.dataset.edge = 'left';
  conversation.style.setProperty('--edge-swipe', '110px');

  window.setTimeout(() => {
    button.dataset.animatedBackBypass = '1';
    button.click();
    delete button.dataset.animatedBackBypass;
    locked = false;
  }, EXIT_MS);

  return true;
}

document.addEventListener('click', (event) => {
  const button = event.target.closest?.('.mobile-back');
  if (!button || button.dataset.animatedBackBypass === '1') return;

  if (animateBack(button)) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);
