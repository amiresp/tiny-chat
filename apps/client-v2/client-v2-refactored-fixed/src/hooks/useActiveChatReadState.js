import { useCallback, useEffect, useMemo, useRef } from 'react';
import { api } from '../api';

export function useActiveChatReadState(chat, messages) {
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);
  const lastMessageId = useMemo(() => {
    const last = messages?.[messages.length - 1];
    return Number(last?.id || 0);
  }, [messages]);

  const markRead = useCallback(() => {
    if (!chat?.id || chat.type === 'rss') return;
    if (document.hidden || !document.hasFocus()) return;

    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      if (inFlightRef.current || document.hidden || !document.hasFocus()) return;
      inFlightRef.current = true;
      try {
        await api(`/api/v2/chats/${chat.id}/read`, { method: 'POST' });
      } catch {
        // Read sync is best-effort and should never interrupt the chat UI.
      } finally {
        inFlightRef.current = false;
      }
    }, 90);
  }, [chat?.id, chat?.type]);

  useEffect(() => {
    markRead();
  }, [markRead, lastMessageId, messages?.length]);

  useEffect(() => {
    const onVisibility = () => { if (!document.hidden) markRead(); };
    const onFocus = () => markRead();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.clearTimeout(timerRef.current);
    };
  }, [markRead]);
}
