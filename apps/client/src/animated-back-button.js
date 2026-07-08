let locked = false;

function isMobile() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function animateBack(button) {
  if (locked || !isMobile()) return false;

  const conversation = document.querySelector('.conversation:not(.mobile-hidden)');
  if (!conversation || conversation.classList.contains('edge-swiping')) return false;

  locked = true;
  const rect = conversation.getBoundingClientRect();
  const ghost = conversation.cloneNode(true);
  ghost.classList.add('swipe-back-ghost');
  ghost.dataset.edge = 'left';
  ghost.style.position = 'fixed';
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.margin = '0';
  ghost.style.zIndex = '999';
  ghost.style.pointerEvents = 'none';
  ghost.style.setProperty('--ghost-start', '0px');
  document.body.appendChild(ghost);
  conversation.classList.add('edge-source-hidden');

  button.dataset.animatedBackBypass = '1';
  button.click();
  delete button.dataset.animatedBackBypass;

  requestAnimationFrame(() => ghost.classList.add('leaving'));
  window.setTimeout(() => {
    ghost.remove();
    locked = false;
  }, 260);

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
