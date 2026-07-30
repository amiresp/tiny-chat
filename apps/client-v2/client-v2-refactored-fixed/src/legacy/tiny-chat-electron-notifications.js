import { io } from 'socket.io-client';
import { api, getToken } from './api';
import { socketOrigin } from './runtime';

if (window.tinyChatElectron?.isElectron) {
  let socket = null;
  let currentUserId = null;
  let reconnectTimer = null;

  async function resolveCurrentUser() {
    const token = getToken();
    if (!token) {
      currentUserId = null;
      return null;
    }
    try {
      const data = await api('/api/me');
      currentUserId = Number(data.user?.id || 0) || null;
      return data.user || null;
    } catch {
      currentUserId = null;
      return null;
    }
  }

  function disconnect() {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
    socket?.close();
    socket = null;
  }

  async function connect() {
    disconnect();
    const token = getToken();
    if (!token) return;

    await resolveCurrentUser();
    socket = io(socketOrigin, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });

    socket.on('message:new', (message) => {
      if (!message || Number(message.senderId) === Number(currentUserId)) return;
      const body = String(message.body || message.fileName || (message.type === 'voice' ? 'Voice message' : 'New attachment')).trim();
      window.tinyChatElectron.notify({
        title: message.senderDisplayName || message.senderName || message.senderUsername || 'Tiny Chat',
        body: body.length > 180 ? `${body.slice(0, 177)}…` : body,
        chatId: message.chatId || null,
        messageId: message.id || null,
      });
    });
  }

  window.addEventListener('verdant-auth-change', () => {
    reconnectTimer = window.setTimeout(connect, 50);
  });

  window.addEventListener('online', () => {
    if (!socket?.connected && getToken()) connect();
  });

  window.addEventListener('beforeunload', disconnect);
  connect();
}
