import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, getToken } from '../api';
import { apiOrigin, socketOrigin } from '../runtime';
import { mergeChats, mergeMessages } from '../lib/chat';

const SHOW_HIDDEN_KEY = 'tiny-chat-show-hidden-chats';

function draftKey(chatId) {
  return `v2-draft-${chatId}`;
}

function totalUnread(chats) {
  return chats.reduce((sum, chat) => sum + Number(chat.unreadCount || 0), 0);
}

export function useChatController(user) {
  const [chats, setChats] = useState([]);
  const [active, setActiveState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setTextState] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilterState] = useState('active');
  const [typeFilter, setTypeFilterState] = useState('all');
  const [showHidden, setShowHidden] = useState(() => sessionStorage.getItem(SHOW_HIDDEN_KEY) === '1');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [chatInfo, setChatInfo] = useState(null);
  const [upload, setUpload] = useState(null);
  const [typingByChat, setTypingByChat] = useState({});
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const activeRef = useRef(null);
  const filterRef = useRef(filter);
  const showHiddenRef = useRef(showHidden);
  const chatsRef = useRef(chats);
  const socketRef = useRef(null);
  const chatLoadGeneration = useRef(0);
  const chatListGeneration = useRef(0);
  const refreshChatsTimer = useRef(null);
  const typingTimers = useRef(new Map());
  const typingStopTimer = useRef(null);
  const typingActiveRef = useRef(false);
  const draftSaveTimer = useRef(null);
  const recorderRef = useRef(null);
  const voiceChunks = useRef([]);
  const voiceStream = useRef(null);
  const recordingInterval = useRef(null);
  const uploadClearTimer = useRef(null);

  useEffect(() => {
    activeRef.current = active;
    typingActiveRef.current = false;
    window.clearTimeout(typingStopTimer.current);
  }, [active]);
  useEffect(() => { filterRef.current = filter; }, [filter]);
  useEffect(() => { showHiddenRef.current = showHidden; }, [showHidden]);
  useEffect(() => { chatsRef.current = chats; }, [chats]);

  const setActive = useCallback((chat) => {
    activeRef.current = chat;
    setActiveState(chat);
    setReplyTo(null);
    if (chat?.id) {
      localStorage.setItem('verdant-last-chat-id', String(chat.id));
      const url = new URL(location.href);
      url.searchParams.set('chat', String(chat.id));
      url.searchParams.set('view', 'chat');
      history.replaceState({}, '', url);
    } else {
      localStorage.removeItem('verdant-last-chat-id');
      const url = new URL(location.href);
      url.searchParams.delete('chat');
      url.searchParams.set('view', 'chats');
      history.replaceState({}, '', url);
    }
  }, []);

  const loadChats = useCallback(async ({ includeHidden = showHiddenRef.current, quiet = false } = {}) => {
    const generation = ++chatListGeneration.current;
    try {
      const visibleData = await api('/api/v2/chats');
      let nextChats = visibleData.chats || [];
      if (includeHidden) {
        try {
          const hiddenData = await api('/api/v2/chats/hidden');
          nextChats = mergeChats(nextChats, hiddenData.chats || []);
        } catch {
          // Hidden chats are optional for older backends.
        }
      }
      if (generation !== chatListGeneration.current) return chatsRef.current;
      setChats(nextChats);

      const currentActive = activeRef.current;
      if (currentActive) {
        const fresh = nextChats.find((chat) => Number(chat.id) === Number(currentActive.id));
        if (fresh) {
          activeRef.current = { ...currentActive, ...fresh };
          setActiveState((current) => current ? { ...current, ...fresh } : current);
        }
      } else {
        const wantedId = Number(new URLSearchParams(location.search).get('chat') || localStorage.getItem('verdant-last-chat-id') || 0);
        const wanted = wantedId ? nextChats.find((chat) => Number(chat.id) === wantedId) : null;
        if (wanted) setActive(wanted);
      }
      return nextChats;
    } catch (error) {
      if (!quiet) setToast(error.message);
      throw error;
    }
  }, [setActive]);

  const scheduleChatsRefresh = useCallback(() => {
    window.clearTimeout(refreshChatsTimer.current);
    refreshChatsTimer.current = window.setTimeout(() => {
      loadChats({ includeHidden: showHiddenRef.current, quiet: true }).catch(() => {});
    }, 220);
  }, [loadChats]);

  const loadChat = useCallback(async (chat) => {
    if (!chat?.id) return;
    const generation = ++chatLoadGeneration.current;
    setLoading(true);
    setReplyTo(null);
    setTextState(localStorage.getItem(draftKey(chat.id)) || '');
    setChatInfo(null);

    try {
      const messagesRequest = chat.type === 'rss'
        ? api(`/api/chats/${chat.id}/messages`)
        : api(`/api/v2/chats/${chat.id}/messages/page?limit=60`);
      const infoRequest = api(`/api/v2/chats/${chat.id}/info`).catch(() => null);
      const [messageData, infoData] = await Promise.all([messagesRequest, infoRequest]);
      if (generation !== chatLoadGeneration.current || Number(activeRef.current?.id) !== Number(chat.id)) return;
      setMessages(chat.type === 'rss' ? (messageData.items || []) : (messageData.messages || []));
      setChatInfo(infoData);
    } catch (error) {
      if (generation === chatLoadGeneration.current) setToast(error.message);
    } finally {
      if (generation === chatLoadGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active?.id) loadChat(active);
    else {
      ++chatLoadGeneration.current;
      setMessages([]);
      setChatInfo(null);
      setTextState('');
    }
  }, [active?.id, loadChat]);

  const handleTypingUpdate = useCallback((event) => {
    if (!event || Number(event.userId) === Number(user?.id)) return;
    const chatId = Number(event.chatId);
    const userId = Number(event.userId);
    setTypingByChat((current) => {
      const chatMap = { ...(current[chatId] || {}) };
      if (event.typing) chatMap[userId] = event;
      else delete chatMap[userId];
      return { ...current, [chatId]: chatMap };
    });

    const key = `${chatId}:${userId}`;
    window.clearTimeout(typingTimers.current.get(key));
    if (event.typing) {
      typingTimers.current.set(key, window.setTimeout(() => {
        setTypingByChat((current) => {
          const chatMap = { ...(current[chatId] || {}) };
          delete chatMap[userId];
          return { ...current, [chatId]: chatMap };
        });
        typingTimers.current.delete(key);
      }, 4500));
    } else {
      typingTimers.current.delete(key);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !getToken()) return undefined;
    const socket = io(socketOrigin, {
      auth: { token: getToken() },
      reconnection: true,
      reconnectionDelay: 700,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    socket.on('message:new', (message) => {
      if (Number(message.chatId) === Number(activeRef.current?.id)) {
        setMessages((current) => mergeMessages(current, [message]));
      }
      if (Number(message.senderId) !== Number(user.id) && window.tinyChatElectron?.isElectron) {
        const body = String(message.body || message.fileName || (message.type === 'voice' ? 'Voice message' : 'New attachment')).trim();
        window.tinyChatElectron.notify({
          title: message.senderDisplayName || message.senderName || message.senderUsername || 'Tiny Chat',
          body: body.length > 180 ? `${body.slice(0, 177)}…` : body,
          chatId: message.chatId || null,
          messageId: message.id || null,
        });
      }
      scheduleChatsRefresh();
    });
    socket.on('message:updated', (message) => setMessages((current) => current.map((item) => item.id === message.id ? message : item)));
    socket.on('message:status', (message) => setMessages((current) => current.map((item) => item.id === message.id ? { ...item, ...message } : item)));
    socket.on('message:read', scheduleChatsRefresh);
    socket.on('message:deleted', ({ id, deletedAt }) => setMessages((current) => current.map((item) => item.id === id ? { ...item, deletedAt, body: null, type: 'deleted' } : item)));
    socket.on('typing:update', handleTypingUpdate);
    socket.on('chat:pinned-message', ({ chatId, message }) => {
      if (Number(chatId) === Number(activeRef.current?.id)) setChatInfo((current) => ({ ...(current || {}), pinnedMessage: message }));
    });
    socket.on('chat:new', scheduleChatsRefresh);
    socket.on('presence', (event) => {
      if (!event?.userId) return;
      setChats((current) => current.map((chat) => {
        if (chat.type !== 'direct' || Number(chat.peer?.id) !== Number(event.userId)) return chat;
        return { ...chat, peer: { ...chat.peer, isOnline: event.status === 'online', lastSeenAt: event.status === 'offline' ? (event.lastSeenAt || chat.peer?.lastSeenAt) : chat.peer?.lastSeenAt } };
      }));
    });
    socket.on('connect_error', () => {});

    return () => {
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [user?.id, handleTypingUpdate, scheduleChatsRefresh]);

  useEffect(() => {
    if (!window.tinyChatElectron?.onNotificationClick) return undefined;
    return window.tinyChatElectron.onNotificationClick(async (payload) => {
      const id = Number(payload?.chatId || 0);
      if (!id) return;
      let target = chatsRef.current.find((chat) => Number(chat.id) === id);
      if (!target) {
        const next = await loadChats({ includeHidden: true, quiet: true }).catch(() => []);
        target = next.find((chat) => Number(chat.id) === id);
      }
      if (target) setActive(target);
    });
  }, [loadChats, setActive]);

  const sendTyping = useCallback(async (isTyping) => {
    const current = activeRef.current;
    if (!current || current.type === 'rss') return;
    if (isTyping === typingActiveRef.current) return;
    typingActiveRef.current = isTyping;
    try {
      await api(`/api/v2/chats/${current.id}/typing`, { method: 'POST', body: JSON.stringify({ typing: isTyping }) });
    } catch {
      if (isTyping) typingActiveRef.current = false;
    }
  }, []);

  const updateDraft = useCallback((value) => {
    setTextState(value);
    const current = activeRef.current;
    if (!current) return;

    window.clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = window.setTimeout(() => {
      if (value.trim()) localStorage.setItem(draftKey(current.id), value);
      else localStorage.removeItem(draftKey(current.id));
    }, 160);

    if (value.trim()) {
      sendTyping(true);
      window.clearTimeout(typingStopTimer.current);
      typingStopTimer.current = window.setTimeout(() => sendTyping(false), 1800);
    } else {
      window.clearTimeout(typingStopTimer.current);
      sendTyping(false);
    }
  }, [sendTyping]);

  const send = useCallback(async () => {
    const current = activeRef.current;
    const body = text.trim();
    if (!current || !body || current.type === 'rss') return;
    await sendTyping(false);
    const currentReply = replyTo;
    setTextState('');
    setReplyTo(null);
    localStorage.removeItem(draftKey(current.id));

    try {
      const data = await api(`/api/v2/chats/${current.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, replyToId: currentReply?.id || null, clientId: crypto.randomUUID() }),
      });
      if (Number(activeRef.current?.id) === Number(current.id)) {
        setMessages((existing) => mergeMessages(existing, [data.message]));
      }
      scheduleChatsRefresh();
    } catch (error) {
      setToast(error.message);
      if (Number(activeRef.current?.id) === Number(current.id)) {
        setTextState(body);
        setReplyTo(currentReply);
      }
    }
  }, [replyTo, text, scheduleChatsRefresh, sendTyping]);

  const uploadFile = useCallback(async (file) => {
    const current = activeRef.current;
    if (!current || !file) return;
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('clientId', crypto.randomUUID());
    formData.append('type', file.type.startsWith('audio/') ? 'voice' : 'file');
    setUpload({ name: file.name, percent: 2 });

    try {
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${apiOrigin}/api/chats/${current.id}/files`);
        const token = getToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (event) => event.lengthComputable && setUpload({ name: file.name, percent: Math.round((event.loaded / event.total) * 100) });
        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`Upload failed (${xhr.status})`));
          try { resolve(JSON.parse(xhr.responseText || '{}')); } catch { resolve({}); }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(formData);
      });

      if (Number(activeRef.current?.id) === Number(current.id)) {
        if (result?.message) setMessages((existing) => mergeMessages(existing, [result.message]));
        else await loadChat(current);
      }
      scheduleChatsRefresh();
    } catch (error) {
      setToast(error.message);
    } finally {
      window.clearTimeout(uploadClearTimer.current);
      uploadClearTimer.current = window.setTimeout(() => setUpload(null), 500);
    }
  }, [loadChat, scheduleChatsRefresh]);

  const startVoiceRecording = useCallback(async () => {
    if (!activeRef.current || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceStream.current = stream;
      recorderRef.current = recorder;
      voiceChunks.current = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) voiceChunks.current.push(event.data); };
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingInterval.current = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    } catch (error) {
      setToast(error.message || 'Microphone is not available');
    }
  }, [recording]);

  const cancelVoiceRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    window.clearInterval(recordingInterval.current);
    voiceStream.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    voiceStream.current = null;
    voiceChunks.current = [];
    setRecording(false);
    setRecordingSeconds(0);
  }, []);

  const stopVoiceRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    await new Promise((resolve) => {
      const previous = recorder.onstop;
      recorder.onstop = (event) => { previous?.(event); resolve(); };
      recorder.stop();
    });
    window.clearInterval(recordingInterval.current);
    setRecording(false);
    const blob = new Blob(voiceChunks.current, { type: 'audio/webm' });
    voiceStream.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    voiceStream.current = null;
    voiceChunks.current = [];
    setRecordingSeconds(0);
    if (blob.size) await uploadFile(new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' }));
  }, [uploadFile]);

  const updatePreference = useCallback(async (key, target = activeRef.current) => {
    if (!target) return;
    try {
      const data = await api(`/api/v2/chats/${target.id}/preferences`, { method: 'PATCH', body: JSON.stringify({ [key]: !target[key] }) });
      const next = { ...target, ...data.preferences };
      setChats((list) => list.map((chat) => Number(chat.id) === Number(next.id) ? { ...chat, ...data.preferences } : chat));
      if (Number(activeRef.current?.id) === Number(next.id)) {
        activeRef.current = next;
        setActiveState(next);
        if (key === 'archived' && data.preferences.archived) setActive(null);
      }
    } catch (error) { setToast(error.message); }
  }, [setActive]);

  const toggleHidden = useCallback(async () => {
    const current = activeRef.current;
    if (!current || current.type === 'saved') return;
    try {
      await api(`/api/v2/chats/${current.id}/hidden`, { method: 'PATCH', body: JSON.stringify({ hidden: !current.hidden }) });
      setToast(current.hidden ? 'Chat is visible again' : 'Chat hidden');
      setActive(null);
      await loadChats({ includeHidden: showHiddenRef.current, quiet: true });
    } catch (error) { setToast(error.message); }
  }, [loadChats, setActive]);

  const deleteActiveChat = useCallback(async () => {
    const current = activeRef.current;
    if (!current || current.type === 'saved') return;
    try {
      await api(`/api/v2/chats/${current.id}`, { method: 'DELETE' });
      setActive(null);
      await loadChats({ includeHidden: showHiddenRef.current, quiet: true });
      setToast('Chat deleted');
    } catch (error) { setToast(error.message); }
  }, [loadChats, setActive]);

  const blockPeer = useCallback(async (userId) => {
    try { await api(`/api/v2/users/${userId}/block`, { method: 'POST' }); setToast('User blocked'); } catch (error) { setToast(error.message); }
  }, []);

  const unpinPinnedMessage = useCallback(async () => {
    const current = activeRef.current;
    if (!current) return;
    try { await api(`/api/v2/chats/${current.id}/pinned-message`, { method: 'DELETE' }); setChatInfo((info) => ({ ...(info || {}), pinnedMessage: null })); } catch (error) { setToast(error.message); }
  }, []);

  const forwardMessageToChat = useCallback(async (message, targetChat) => {
    if (!message || !targetChat) return;
    try {
      await api(`/api/v2/messages/${message.id}/forward`, { method: 'POST', body: JSON.stringify({ chatId: targetChat.id }) });
      setToast(`Forwarded to ${targetChat.title}`);
      scheduleChatsRefresh();
    } catch (error) { setToast(error.message); }
  }, [scheduleChatsRefresh]);

  const runMessageCommand = useCallback(async (role, message) => {
    const current = activeRef.current;
    if (!message || !current) return { handled: false };
    try {
      if (role === 'reply') { setReplyTo(message); return { handled: true }; }
      if (role === 'copy') {
        const copyText = message.body || message.fileName || '';
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
          await navigator.clipboard.writeText(copyText);
        } catch {
          const textarea = document.createElement('textarea');
          textarea.value = copyText;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          textarea.remove();
        }
        return { handled: true };
      }
      if (role === 'edit') {
        const body = window.prompt('Edit message', message.body || '');
        if (body && body.trim() && body.trim() !== message.body) {
          const data = await api(`/api/v2/messages/${message.id}`, { method: 'PATCH', body: JSON.stringify({ body: body.trim() }) });
          setMessages((items) => items.map((item) => item.id === data.message.id ? data.message : item));
        }
        return { handled: true };
      }
      if (role === 'delete') await api(`/api/v2/messages/${message.id}`, { method: 'DELETE' });
      if (role === 'save') {
        const saved = chatsRef.current.find((chat) => chat.type === 'saved');
        if (saved) await api(`/api/v2/messages/${message.id}/forward`, { method: 'POST', body: JSON.stringify({ chatId: saved.id }) });
      }
      if (role === 'pin') {
        const data = await api(`/api/v2/messages/${message.id}/pin`, { method: 'POST' });
        setChatInfo((info) => ({ ...(info || {}), pinnedMessage: data.message || message }));
      }
      if (Number(activeRef.current?.id) === Number(current.id)) await loadChat(current);
      scheduleChatsRefresh();
      return { handled: true };
    } catch (error) {
      setToast(error.message);
      return { handled: true, error };
    }
  }, [loadChat, scheduleChatsRefresh]);

  const createInvite = useCallback(async () => {
    const current = activeRef.current;
    if (!current) return;
    try {
      const data = await api(`/api/v2/chats/${current.id}/invites`, { method: 'POST' });
      await navigator.clipboard?.writeText(`${location.origin}${data.invite.url}`);
      setToast('Invite link copied');
    } catch (error) { setToast(error.message); }
  }, []);

  const setFilter = useCallback((value) => {
    filterRef.current = value;
    setFilterState(value === 'archived' ? 'archived' : 'active');
  }, []);

  const setTypeFilter = useCallback((value) => {
    setTypeFilterState(['all', 'private', 'groups', 'rss'].includes(value) ? value : 'all');
  }, []);

  const toggleHiddenReveal = useCallback(async () => {
    const next = !showHiddenRef.current;
    showHiddenRef.current = next;
    sessionStorage.setItem(SHOW_HIDDEN_KEY, next ? '1' : '0');
    setShowHidden(next);
    await loadChats({ includeHidden: next, quiet: true }).catch(() => {});
  }, [loadChats]);

  useEffect(() => () => {
    window.clearTimeout(refreshChatsTimer.current);
    window.clearTimeout(typingStopTimer.current);
    window.clearTimeout(draftSaveTimer.current);
    window.clearTimeout(uploadClearTimer.current);
    for (const timer of typingTimers.current.values()) window.clearTimeout(timer);
    window.clearInterval(recordingInterval.current);
    voiceStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const activeTypingUsers = useMemo(() => Object.values(typingByChat[Number(active?.id)] || {}), [typingByChat, active?.id]);

  return {
    chats, active, messages, text, replyTo, query, filter, typeFilter, showHidden, loading, toast, chatInfo, upload,
    recording, recordingSeconds, activeTypingUsers,
    setActive, setQuery, setFilter, setTypeFilter, toggleHiddenReveal, setToast, setReplyTo,
    loadChats, loadChat, updateDraft, send, uploadFile,
    startVoiceRecording, stopVoiceRecording, cancelVoiceRecording,
    updatePreference, toggleHidden, deleteActiveChat, blockPeer, unpinPinnedMessage,
    forwardMessageToChat, runMessageCommand, createInvite,
  };
}
