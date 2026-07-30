import { useEffect } from 'react';

const DEFAULT_TITLE = 'Tiny Chat';
const DEFAULT_FAVICON = '/icon.svg';

function makeUnreadIcon(count, dimmed = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return DEFAULT_FAVICON;
  ctx.fillStyle = dimmed ? '#94a3b8' : '#09b8d5';
  ctx.beginPath(); ctx.arc(29, 31, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  [21,29,37].forEach((x) => { ctx.beginPath(); ctx.arc(x,31,3.4,0,Math.PI*2); ctx.fill(); });
  if (count > 0) {
    const text = count > 99 ? '99+' : String(count);
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(48,16,14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${text.length > 2 ? 12 : 15}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text,48,16.5);
  }
  return canvas.toDataURL('image/png');
}

function faviconLink() {
  let link = document.querySelector('link[rel~="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  return link;
}

export function useBrowserAttention(chats) {
  useEffect(() => {
    const count = chats.reduce((sum, chat) => sum + Number(chat.unreadCount || 0), 0);
    const link = faviconLink();
    const normal = count > 0 ? makeUnreadIcon(count, false) : DEFAULT_FAVICON;
    const dimmed = count > 0 ? makeUnreadIcon(count, true) : DEFAULT_FAVICON;
    let timer = null; let flip = false;
    const render = () => {
      document.title = count > 0 ? `(${count > 99 ? '99+' : count}) ${DEFAULT_TITLE}` : DEFAULT_TITLE;
      window.clearInterval(timer);
      timer = null;
      if (!count) { link.type = 'image/svg+xml'; link.href = DEFAULT_FAVICON; return; }
      link.type = 'image/png'; link.href = normal;
      if (document.hidden) timer = window.setInterval(() => { flip = !flip; link.href = flip ? dimmed : normal; }, 700);
    };
    render();
    document.addEventListener('visibilitychange', render);
    return () => { document.removeEventListener('visibilitychange', render); window.clearInterval(timer); };
  }, [chats]);
}
