const originalFetch = window.fetch.bind(window);

let chatGeneration = 0;
let switching = false;

const MESSAGE_REQUEST_RE = /\/api\/(?:v2\/chats\/\d+\/messages\/page|chats\/\d+\/messages)(?:[/?]|$)/i;
const CHAT_INFO_RE = /\/api\/v2\/chats\/\d+\/info(?:[/?]|$)/i;

const style = document.createElement('style');
style.textContent = `
  body.tiny-chat-switching .messages-content .message-stack {
    visibility: hidden !important;
    pointer-events: none !important;
  }

  body.tiny-chat-switching .messages-content::after {
    content: 'Loading…';
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    min-height: 180px;
    color: var(--vc-muted, #64748b);
    font-size: 13px;
    font-weight: 700;
    pointer-events: none;
  }
`;
document.head.appendChild(style);

function beginSwitch() {
  switching = true;
  document.body.classList.add('tiny-chat-switching');
}

function finishSwitch(generation) {
  if (generation !== chatGeneration) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (generation !== chatGeneration) return;
      switching = false;
      document.body.classList.remove('tiny-chat-switching');
    });
  });
}

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input?.url || '';
}

function requestMethod(input, init) {
  return String(init?.method || input?.method || 'GET').toUpperCase();
}

function staleRequestError() {
  const error = new Error('');
  error.name = 'AbortError';
  error.tinyChatStaleRequest = true;
  return error;
}

window.fetch = async function tinyChatFetch(input, init) {
  const url = requestUrl(input);
  const method = requestMethod(input, init);
  const isMessageLoad = method === 'GET' && MESSAGE_REQUEST_RE.test(url);
  const isChatInfo = method === 'GET' && CHAT_INFO_RE.test(url);

  let requestGeneration = chatGeneration;
  if (isMessageLoad) {
    requestGeneration = ++chatGeneration;
    beginSwitch();
  }

  const response = await originalFetch(input, init);

  if (!isMessageLoad && !isChatInfo) return response;

  const originalJson = response.json.bind(response);
  response.json = async () => {
    const data = await originalJson();

    if (requestGeneration !== chatGeneration) {
      throw staleRequestError();
    }

    if (isMessageLoad) finishSwitch(requestGeneration);
    return data;
  };

  return response;
};

// Invalidate the previous chat request before React starts loading the newly
// selected conversation. This hides old messages in the same click frame.
document.addEventListener('click', (event) => {
  const row = event.target.closest?.('.chat-row');
  if (row && !row.classList.contains('active')) {
    chatGeneration += 1;
    beginSwitch();
    return;
  }

  if (event.target.closest?.('.back-arrow')) {
    chatGeneration += 1;
    switching = false;
    document.body.classList.remove('tiny-chat-switching');
  }
}, true);

window.addEventListener('pageshow', () => {
  if (!switching) document.body.classList.remove('tiny-chat-switching');
});
