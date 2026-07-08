function isRssConversation() {
  return Boolean(document.querySelector('.conversation .rss-messages'));
}

function refreshCurrentConversation() {
  const menu = document.querySelector('.conversation-menu');
  const toggle = document.querySelector('.conversation-actions > button');

  function clickRefresh() {
    const refreshButton = [...document.querySelectorAll('.conversation-menu button')]
      .find((button) => button.textContent?.toLowerCase().includes('refresh'));

    if (refreshButton) {
      refreshButton.click();
      window.setTimeout(() => {
        if (document.querySelector('.conversation-menu')) toggle?.click();
      }, 80);
      return true;
    }

    return false;
  }

  if (menu && clickRefresh()) return;

  if (toggle) {
    toggle.click();
    window.setTimeout(() => {
      if (!clickRefresh()) window.location.reload();
    }, 40);
    return;
  }

  window.location.reload();
}

function enhanceErrorBox() {
  const errorBox = document.querySelector('.conversation-error');
  if (!errorBox || !isRssConversation()) return;
  if (errorBox.querySelector('.rss-retry-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rss-retry-button';
  button.textContent = 'Retry';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    refreshCurrentConversation();
  });

  errorBox.appendChild(button);
}

const observer = new MutationObserver(() => enhanceErrorBox());
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener('DOMContentLoaded', enhanceErrorBox);
window.addEventListener('focus', enhanceErrorBox);
