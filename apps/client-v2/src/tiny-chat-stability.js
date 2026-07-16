import './tiny-chat-stability.css';

const EMOJI_GROUPS = {
  Recent: ['😀','😂','🥰','😍','😊','😉','😎','🤔','😭','😡','👍','❤️'],
  Smileys: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','🤗','🤔','🫣','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴'],
  Gestures: ['👍','👎','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','👏','🙌','🫶','👐','🤲','🙏','✍️','💪'],
  Hearts: ['❤️','🩷','🧡','💛','💚','💙','🩵','💜','🤎','🖤','🩶','🤍','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'],
  Animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦄','🐝','🦋'],
  Food: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍕','🍔','🍟','🌭','🍿','🍩','🍪','🎂','☕'],
  Activities: ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🏸','🥊','🎮','🎯','🎲','🎸','🎧','🎤','🎬','🎨','🏆','🥇'],
  Travel: ['🚗','🚕','🚌','🚎','🏎️','🚓','🚑','🚒','🚚','🚲','🛵','🏍️','✈️','🚀','🚁','⛵','🚢','🏠','🏢','🌍','🌙','⭐','☀️','🌈'],
  Symbols: ['✅','❌','⚠️','❓','❗','💯','🔥','✨','🎉','🎊','💡','📌','📍','🔒','🔓','🔔','🔕','💬','💭','🗨️','📎','📁','📷','🎥'],
};

const RECENT_KEY = 'tiny-chat-recent-emojis';
let picker = null;
let activeTextarea = null;

function dedupeAdminTabs() {
  document.querySelectorAll('.tiny-settings-nav').forEach((nav) => {
    const buttons = [...nav.querySelectorAll('[data-admin-chat-tab], [data-settings-tab="admin"]')];
    if (buttons.length <= 1) return;
    const keep = buttons[buttons.length - 1];
    buttons.forEach((button) => {
      if (button !== keep) button.remove();
    });
  });
}

function getRecent() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(value) ? value.slice(0, 24) : [];
  } catch {
    return [];
  }
}

function saveRecent(emoji) {
  const next = [emoji, ...getRecent().filter((item) => item !== emoji)].slice(0, 24);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function closePicker() {
  picker?.remove();
  picker = null;
  activeTextarea = null;
  document.documentElement.classList.remove('tiny-emoji-open');
}

async function insertEmoji(textarea, emoji) {
  if (!textarea) return;
  const input = typeof textarea.getInputElement === 'function'
    ? await textarea.getInputElement().catch(() => null)
    : null;
  const current = String(textarea.value || input?.value || '');
  const start = Number.isInteger(input?.selectionStart) ? input.selectionStart : current.length;
  const end = Number.isInteger(input?.selectionEnd) ? input.selectionEnd : start;
  const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
  textarea.value = next;
  if (input) {
    input.value = next;
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange?.(start + emoji.length, start + emoji.length);
    });
  }
  textarea.dispatchEvent(new CustomEvent('ionInput', {
    detail: { value: next },
    bubbles: true,
    composed: true,
  }));
  saveRecent(emoji);
}

function renderEmojiGrid(group = 'Recent', query = '') {
  if (!picker) return;
  const grid = picker.querySelector('[data-emoji-grid]');
  const empty = picker.querySelector('[data-emoji-empty]');
  let emojis;
  if (query.trim()) {
    emojis = [...new Set(Object.values(EMOJI_GROUPS).flat())];
  } else if (group === 'Recent') {
    emojis = getRecent().length ? getRecent() : EMOJI_GROUPS.Recent;
  } else {
    emojis = EMOJI_GROUPS[group] || [];
  }
  grid.innerHTML = emojis.map((emoji) => `<button type="button" data-emoji="${emoji}" aria-label="${emoji}">${emoji}</button>`).join('');
  empty.hidden = Boolean(emojis.length);
}

function positionPicker(button) {
  if (!picker || !button) return;
  const rect = button.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 20);
  picker.style.setProperty('--tiny-emoji-width', `${width}px`);
  if (window.innerWidth < 768) {
    picker.classList.add('mobile');
    picker.style.left = '10px';
    picker.style.right = '10px';
    picker.style.bottom = '78px';
    picker.style.top = 'auto';
    return;
  }
  picker.classList.remove('mobile');
  const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.left));
  const bottom = Math.max(12, window.innerHeight - rect.top + 8);
  picker.style.left = `${left}px`;
  picker.style.right = 'auto';
  picker.style.bottom = `${bottom}px`;
  picker.style.top = 'auto';
}

function openPicker(button) {
  closePicker();
  activeTextarea = button.closest('.composer-bar')?.querySelector('ion-textarea') || document.querySelector('.composer-bar ion-textarea');
  if (!activeTextarea) return;

  picker = document.createElement('section');
  picker.className = 'tiny-emoji-picker';
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-label', 'Emoji picker');
  picker.innerHTML = `
    <header>
      <label><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg><input type="search" placeholder="Search emojis" aria-label="Search emojis"></label>
      <button type="button" data-close aria-label="Close emoji picker">×</button>
    </header>
    <nav data-emoji-tabs>
      ${Object.keys(EMOJI_GROUPS).map((name, index) => `<button type="button" data-group="${name}" class="${index === 0 ? 'active' : ''}" title="${name}">${name === 'Recent' ? '🕘' : EMOJI_GROUPS[name][0]}</button>`).join('')}
    </nav>
    <div class="tiny-emoji-grid" data-emoji-grid></div>
    <div class="tiny-emoji-empty" data-emoji-empty hidden>No emojis found.</div>
  `;
  document.body.appendChild(picker);
  document.documentElement.classList.add('tiny-emoji-open');
  positionPicker(button);
  renderEmojiGrid('Recent');

  const search = picker.querySelector('input[type="search"]');
  picker.querySelector('[data-close]').addEventListener('click', closePicker);
  picker.querySelector('[data-emoji-tabs]').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-group]');
    if (!tab) return;
    picker.querySelectorAll('[data-group]').forEach((item) => item.classList.toggle('active', item === tab));
    search.value = '';
    renderEmojiGrid(tab.dataset.group);
  });
  picker.querySelector('[data-emoji-grid]').addEventListener('click', async (event) => {
    const emojiButton = event.target.closest('[data-emoji]');
    if (!emojiButton) return;
    await insertEmoji(activeTextarea, emojiButton.dataset.emoji);
    renderEmojiGrid('Recent');
  });
  search.addEventListener('input', () => renderEmojiGrid('Recent', search.value));
  setTimeout(() => search.focus(), 50);
}

function interceptEmojiButton(event) {
  const button = event.target.closest('.tiny-emoji-button');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  if (picker) closePicker();
  else openPicker(button);
}

document.addEventListener('click', interceptEmojiButton, true);
document.addEventListener('pointerdown', (event) => {
  if (!picker) return;
  if (event.target.closest('.tiny-emoji-picker,.tiny-emoji-button')) return;
  closePicker();
}, true);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && picker) {
    event.preventDefault();
    closePicker();
  }
});
window.addEventListener('resize', () => {
  if (picker) closePicker();
}, { passive: true });

const observer = new MutationObserver(() => dedupeAdminTabs());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', () => setTimeout(dedupeAdminTabs, 300));
setInterval(dedupeAdminTabs, 1200);
