function articleLink(card) {
  return card.querySelector('.rss-link')?.href || card.querySelector('.rss-image')?.href || null;
}

function enhanceCard(card) {
  if (card.dataset.enhanced === 'true') return;
  const href = articleLink(card);
  if (!href) return;

  card.dataset.enhanced = 'true';
  card.tabIndex = 0;
  card.setAttribute('role', 'link');
  card.setAttribute('aria-label', card.querySelector('h3')?.textContent || 'Open RSS article');

  card.addEventListener('click', (event) => {
    if (event.target.closest('a,button')) return;
    window.open(href, '_blank', 'noopener,noreferrer');
  });

  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    window.open(href, '_blank', 'noopener,noreferrer');
  });
}

function enhanceAll() {
  document.querySelectorAll('.rss-card').forEach(enhanceCard);
}

const observer = new MutationObserver(enhanceAll);
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener('DOMContentLoaded', enhanceAll);
window.addEventListener('focus', enhanceAll);
