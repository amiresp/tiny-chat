let selectedCopyText = '';

function messageTextFromBubble(bubble) {
  if (!bubble) return '';
  const body = bubble.querySelector('.message-text')?.textContent?.trim();
  if (body) return body;
  const file = bubble.querySelector('.file-chip')?.textContent?.trim();
  return file || '';
}

function rememberMessage(event) {
  const bubble = event.target.closest?.('.message-bubble');
  if (!bubble) return;
  selectedCopyText = messageTextFromBubble(bubble);
}

function isCopyAction(event) {
  const path = event.composedPath?.() || [];
  return path.some((node) => {
    if (!(node instanceof HTMLElement)) return false;
    const text = node.textContent?.trim();
    return text === 'Copy' && (
      node.classList.contains('action-sheet-button') ||
      node.closest?.('ion-action-sheet') ||
      node.tagName === 'BUTTON'
    );
  });
}

async function handleCopyAction(event) {
  if (!isCopyAction(event) || !selectedCopyText) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  try {
    await navigator.clipboard?.writeText(selectedCopyText);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = selectedCopyText;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  const sheet = document.querySelector('ion-action-sheet');
  sheet?.dismiss?.();
}

document.addEventListener('click', rememberMessage, true);
document.addEventListener('contextmenu', rememberMessage, true);
document.addEventListener('click', handleCopyAction, true);
