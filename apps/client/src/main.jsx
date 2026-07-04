import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import {
  Archive,
  CalendarDays,
  Check,
  ExternalLink,
  FileUp,
  LogOut,
  Menu,
  Mic,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  Smile,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api, getToken, setToken } from './api';
import { apiOrigin, socketOrigin } from './runtime';
import { cacheChats, cacheMessages, enqueue, offlineDb, queued } from './offline';
import './styles.css';

function resolveAssetUrl(value) {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${apiOrigin}${value}`;
  return value;
}

function displayName(entity, fallback = 'Conversation') {
  return entity?.displayName || entity?.title || entity?.username || fallback;
}

function initials(entity) {
  return displayName(entity, 'C').trim().slice(0, 2).toUpperCase();
}

function formatPresence(peer) {
  if (!peer) return 'Open conversation';
  if (peer.isOnline) return 'online';
  if (peer.hidePresence) return 'last seen hidden';
  if (!peer.lastSeenAt) return 'offline';
  const date = new Date(peer.lastSeenAt);
  if (Number.isNaN(date.getTime())) return 'offline';
  return `last seen ${date.toLocaleString()}`;
}

function Avatar({ entity, icon, className = '' }) {
  const source = resolveAssetUrl(entity?.avatarUrl);
  return (
    <span className={`avatar ${className}`}>
      {source ? <img src={source} alt={displayName(entity)} /> : icon || initials(entity)}
    </span>
  );
}

function Auth({ onDone }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', mobile: '', identity: '', password: '' });
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    try {
      setError('');
      const data = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      setToken(data.token);
      onDone(data.user);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand">
          <img src="/icon.svg" alt="Verdant" />
          <div><b>Verdant</b><span>Calm conversations, everywhere.</span></div>
        </div>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label>Username<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
              <label>Mobile number<input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} /></label>
            </>
          )}
          {mode === 'login' && <label>Username or mobile<input value={form.identity} onChange={(event) => setForm({ ...form, identity: event.target.value })} /></label>}
          <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary">{mode === 'login' ? 'Sign in' : 'Register'}</button>
        </form>
        <button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Create an account' : 'Already have an account?'}
        </button>
      </section>
    </main>
  );
}

function RssShareModal({ chat, onClose }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) {
      setUsers([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/api/users/search?q=${encodeURIComponent(query.trim())}`)
        .then((data) => { if (!cancelled) setUsers(data.users || []); })
        .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  function toggleUser(userId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function share(payload) {
    try {
      setBusy(true);
      setError('');
      setSuccess('');
      const data = await api(`/api/v2/chats/${chat.id}/share`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess(`Shared with ${data.sharedCount} user${data.sharedCount === 1 ? '' : 's'}.`);
      setSelected(new Set());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <section className="share-modal">
        <header><div><h3>Share RSS channel</h3><small>{chat.title}</small></div><button onClick={onClose}><X /></button></header>
        <button className="share-everyone" disabled={busy} onClick={() => share({ all: true })}><Users />Share with everyone</button>
        <div className="modal-divider"><span>or choose users</span></div>
        <div className="search share-search"><Search /><input placeholder="Search users" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="share-users">
          {users.map((candidate) => (
            <button key={candidate.id} className={selected.has(candidate.id) ? 'selected' : ''} onClick={() => toggleUser(candidate.id)}>
              <Avatar entity={candidate} />
              <span><b>{candidate.displayName || candidate.username}</b><small>@{candidate.username}</small></span>
              <span className="share-check">{selected.has(candidate.id) && <Check />}</span>
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <button className="primary" disabled={busy || selected.size === 0} onClick={() => share({ userIds: [...selected] })}>
          Share with selected ({selected.size})
        </button>
      </section>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState(navigator.onLine ? 'connecting' : 'offline');
  const [emoji, setEmoji] = useState(false);
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const socket = useRef(null);
  const file = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const actionsRef = useRef(null);
  const activeIdRef = useRef(null);

  const activeChat = chats.find((chat) => chat.id === active?.id) || active;

  useEffect(() => {
    activeIdRef.current = active?.id ?? null;
  }, [active?.id]);

  useEffect(() => {
    if (!getToken()) return;
    api('/api/me').then((data) => setUser(data.user)).catch(() => setToken(null));
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    loadChats();
    const currentSocket = io(socketOrigin, { auth: { token: getToken() } });
    socket.current = currentSocket;

    currentSocket.on('connect', () => {
      setStatus('connected');
      flush(currentSocket);
    });
    currentSocket.on('disconnect', () => setStatus(navigator.onLine ? 'connecting' : 'offline'));
    currentSocket.on('presence:snapshot', ({ onlineUserIds = [] }) => {
      const onlineSet = new Set(onlineUserIds.map(Number));
      setChats((current) => current.map((chat) => chat.peer ? { ...chat, peer: { ...chat.peer, isOnline: onlineSet.has(Number(chat.peer.id)) } } : chat));
    });
    currentSocket.on('presence', ({ userId, status: presenceStatus, lastSeenAt }) => {
      setChats((current) => current.map((chat) => {
        if (Number(chat.peer?.id) !== Number(userId)) return chat;
        return { ...chat, peer: { ...chat.peer, isOnline: presenceStatus === 'online', lastSeenAt: lastSeenAt || chat.peer.lastSeenAt } };
      }));
    });
    currentSocket.on('chat:new', (chat) => {
      setChats((current) => [{ ...chat, unreadCount: Number(chat.unreadCount || 0) }, ...current.filter((item) => item.id !== chat.id)]);
      cacheChats([chat]).catch(() => {});
    });
    currentSocket.on('message:new', (message) => {
      const isActive = Number(activeIdRef.current) === Number(message.chatId);
      if (isActive) {
        setMessages((current) => [...current.filter((item) => item.clientId !== message.clientId), message]);
        if (message.senderId !== user.id && message.id) {
          currentSocket.emit('message:read', { chatId: message.chatId, messageIds: [message.id] });
        }
      }
      setChats((current) => {
        const found = current.find((chat) => Number(chat.id) === Number(message.chatId));
        if (!found) return current;
        const updated = {
          ...found,
          updatedAt: message.createdAt || new Date().toISOString(),
          unreadCount: isActive || message.senderId === user.id ? 0 : Number(found.unreadCount || 0) + 1,
        };
        return [updated, ...current.filter((chat) => Number(chat.id) !== Number(message.chatId))];
      });
    });
    currentSocket.on('account:banned', () => {
      setToken(null);
      location.reload();
    });

    const online = () => setStatus(currentSocket.connected ? 'connected' : 'connecting');
    const offline = () => setStatus('offline');
    addEventListener('online', online);
    addEventListener('offline', offline);

    return () => {
      currentSocket.close();
      removeEventListener('online', online);
      removeEventListener('offline', offline);
    };
  }, [user]);

  useEffect(() => {
    if (!showActions) return undefined;
    function closeActions(event) {
      if (!actionsRef.current?.contains(event.target)) setShowActions(false);
    }
    document.addEventListener('pointerdown', closeActions);
    return () => document.removeEventListener('pointerdown', closeActions);
  }, [showActions]);

  async function loadChats() {
    try {
      const data = await api('/api/v2/chats');
      setChats(data.chats);
      setActive((current) => current ? data.chats.find((chat) => chat.id === current.id) || current : current);
      await cacheChats(data.chats);
      return data.chats;
    } catch {
      const cached = await offlineDb.chats.orderBy('updatedAt').reverse().toArray();
      setChats(cached);
      return cached;
    }
  }

  async function markRead(chatId, list) {
    const ids = list.filter((message) => message.id && message.senderId !== user.id).map((message) => Number(message.id));
    setChats((current) => current.map((chat) => Number(chat.id) === Number(chatId) ? { ...chat, unreadCount: 0 } : chat));
    if (ids.length && socket.current) socket.current.emit('message:read', { chatId, messageIds: ids });
  }

  async function openChat(chat) {
    setActive(chat);
    setShowNew(false);
    setShowActions(false);
    setShowShare(false);
    setMessages([]);
    setChats((current) => current.map((item) => item.id === chat.id ? { ...item, unreadCount: 0 } : item));

    try {
      const data = await api(`/api/v2/chats/${chat.id}/messages`);
      const list = data.messages || data.items || [];
      setMessages(list);
      if (!data.rss) {
        await cacheMessages(chat.id, list);
        await markRead(chat.id, list);
      }
    } catch (requestError) {
      if (chat.type === 'rss') {
        alert(requestError.message);
        return;
      }
      setMessages(await offlineDb.messages.where('chatId').equals(chat.id).sortBy('createdAt'));
    }
  }

  async function handleChatCreated(chat) {
    setShowNew(false);
    if (!chat) return loadChats();
    setChats((current) => [{ ...chat, unreadCount: 0 }, ...current.filter((item) => item.id !== chat.id)]);
    await cacheChats([chat]);
    await openChat(chat);
    loadChats().catch(() => {});
  }

  async function refreshActiveChat() {
    if (activeChat) await openChat(activeChat);
  }

  async function hideActiveChat() {
    if (!activeChat) return;
    if (!window.confirm(activeChat.type === 'rss' ? 'Remove this RSS channel?' : 'Hide this conversation?')) return;
    try {
      await api(`/api/chats/${activeChat.id}`, { method: 'DELETE' });
      setChats((current) => current.filter((item) => item.id !== activeChat.id));
      setActive(null);
      setMessages([]);
    } catch (requestError) {
      alert(requestError.message);
    }
  }

  async function flush(currentSocket = socket.current) {
    if (!currentSocket) return;
    for (const message of await queued()) {
      await offlineDb.outbox.update(message.clientId, { status: 'sending' });
      currentSocket.emit('message:send', message, async (result) => {
        await offlineDb.outbox.update(message.clientId, { status: result.ok ? 'sent' : 'failed' });
        if (result.ok) await offlineDb.outbox.delete(message.clientId);
      });
    }
  }

  async function send() {
    if (!text.trim() || !activeChat) return;
    const message = {
      clientId: crypto.randomUUID(),
      chatId: activeChat.id,
      body: text.trim(),
      senderId: user.id,
      createdAt: new Date().toISOString(),
      status: status === 'connected' ? 'sending' : 'queued',
    };
    setMessages((current) => [...current, message]);
    setText('');
    await enqueue(message);
    if (status === 'connected') flush();
  }

  async function uploadFile(blob, name, type = 'file') {
    if (!activeChat) return;
    if (blob.size > 50 * 1024 * 1024) return alert('Maximum file size is 50 MB');
    const formData = new FormData();
    formData.append('file', blob, name);
    formData.append('clientId', crypto.randomUUID());
    formData.append('type', type);
    try {
      await api(`/api/chats/${activeChat.id}/files`, { method: 'POST', body: formData });
      await openChat(activeChat);
    } catch (requestError) {
      alert(requestError.message);
    }
  }

  async function voice() {
    if (recorder.current) {
      recorder.current.stop();
      recorder.current = null;
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => chunks.current.push(event.data);
      mediaRecorder.onstop = () => {
        uploadFile(new Blob(chunks.current, { type: 'audio/webm' }), `voice-${Date.now()}.webm`, 'voice');
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      recorder.current = mediaRecorder;
    } catch (requestError) {
      alert(requestError.message || 'Microphone access was denied');
    }
  }

  function exportHtml() {
    if (!activeChat) return;
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const body = messages.map((message) => `<article><b>${escapeHtml(message.senderId === user.id ? user.username : message.author || 'Member')}</b><time>${new Date(message.createdAt).toLocaleString()}</time><p>${escapeHtml(message.body || message.title || '')}</p>${message.imageUrl ? `<img src="${escapeHtml(message.imageUrl)}" style="max-width:100%">` : ''}${message.link ? `<a href="${escapeHtml(message.link)}">Open source</a>` : ''}</article>`).join('');
    const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(activeChat.title || 'Chat export')}</title><style>body{font:16px system-ui;max-width:800px;margin:auto;padding:30px}article{border-bottom:1px solid #ddd;padding:16px}time{float:right;color:#777}a{display:block}</style><h1>${escapeHtml(activeChat.title || 'Conversation')}</h1>${body}`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `verdant-chat-${activeChat.id}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  if (!user) return <Auth onDone={setUser} />;

  const filtered = chats.filter((chat) => (chat.title || chat.type).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app">
      <aside className={activeChat ? 'sidebar mobile-hidden' : 'sidebar'}>
        <header>
          <div className="brand compact"><img src="/icon.svg" alt="Verdant" /><b>Verdant</b></div>
          <button title="New conversation" onClick={() => setShowNew(true)}><Plus /></button>
        </header>
        <div className="search"><Search /><input placeholder="Search chats" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="chat-list">
          {filtered.map((chat) => (
            <button key={chat.id} className={activeChat?.id === chat.id ? 'chat active' : 'chat'} onClick={() => openChat(chat)}>
              <Avatar entity={chat} icon={chat.type === 'group' ? <Users /> : chat.type === 'rss' ? <Archive /> : null} />
              <span className="chat-copy">
                <b>{chat.title || `${chat.type} chat`}</b>
                <small>{chat.type === 'direct' ? formatPresence(chat.peer) : chat.type === 'rss' ? 'RSS channel' : 'Group conversation'}</small>
              </span>
              {Number(chat.unreadCount || 0) > 0 && <span className="unread-badge">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>}
            </button>
          ))}
        </div>
        <footer><span className={`dot ${status}`} /><span>{status}</span><button onClick={() => { setToken(null); location.reload(); }}><LogOut /></button></footer>
      </aside>

      <main className={activeChat ? 'conversation' : 'conversation mobile-hidden'}>
        {activeChat ? (
          <>
            <header className="conversation-head">
              <button className="mobile-back" onClick={() => setActive(null)}><Menu /></button>
              <Avatar entity={activeChat} icon={activeChat.type === 'group' ? <Users /> : activeChat.type === 'rss' ? <Archive /> : null} className="head-avatar" />
              <div className="conversation-title"><b>{activeChat.title || `${activeChat.type} chat`}</b><small>{activeChat.type === 'direct' ? formatPresence(activeChat.peer) : status}</small></div>
              <div className="head-actions">
                <button title="Export HTML" onClick={exportHtml}><Archive /></button>
                <div className="conversation-actions" ref={actionsRef}>
                  <button onClick={() => setShowActions((current) => !current)}><MoreVertical /></button>
                  {showActions && (
                    <div className="conversation-menu">
                      <button onClick={refreshActiveChat}><RefreshCw />Refresh</button>
                      {activeChat.type === 'rss' && (activeChat.ownerId === user.id || user.role === 'admin') && <button onClick={() => { setShowActions(false); setShowShare(true); }}><Share2 />Share RSS</button>}
                      <button className="danger" onClick={hideActiveChat}><Trash2 />{activeChat.type === 'rss' ? 'Remove RSS channel' : 'Hide conversation'}</button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <section className={`messages ${activeChat.type === 'rss' ? 'rss-messages' : ''}`}>
              {messages.map((message, index) => {
                if (message.type === 'rss') {
                  return (
                    <article className="rss-card" key={message.id || index}>
                      {message.imageUrl && <a href={message.link} target="_blank" rel="noreferrer" className="rss-image"><img src={message.imageUrl} alt={message.title || 'RSS article'} /></a>}
                      <div className="rss-content">
                        <div className="rss-meta"><span><CalendarDays />{new Date(message.createdAt).toLocaleString()}</span>{message.author && <span>{message.author}</span>}</div>
                        <h3>{message.title}</h3>
                        <p>{message.body}</p>
                        {message.link && <a className="rss-link" target="_blank" rel="noreferrer" href={message.link}>Read article <ExternalLink /></a>}
                      </div>
                    </article>
                  );
                }

                const fileUrl = resolveAssetUrl(message.fileUrl);
                return (
                  <div key={message.id || message.clientId || index} className={`bubble ${message.senderId === user.id ? 'mine' : ''}`}>
                    <p>{message.body || message.title}</p>
                    {message.mimeType?.startsWith('image/') && fileUrl && <img src={fileUrl} alt={message.fileName || 'Shared file'} />}
                    {message.mimeType?.startsWith('video/') && fileUrl && <video controls src={fileUrl} />}
                    {message.type === 'voice' && fileUrl && <audio controls src={fileUrl} />}
                    {message.fileExpired && <small>File expired</small>}
                    {fileUrl && !message.mimeType?.match(/^(image|video|audio)\//) && <a href={fileUrl}>{message.fileName || 'Download file'}</a>}
                    <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {message.status && `· ${message.status}`}</time>
                  </div>
                );
              })}
            </section>

            {activeChat.type !== 'rss' && (
              <footer className="composer">
                <input ref={file} type="file" hidden onChange={(event) => { const selected = event.target.files?.[0]; if (selected) uploadFile(selected, selected.name); event.target.value = ''; }} />
                <button onClick={() => file.current?.click()}><FileUp /></button>
                <button onClick={() => setEmoji(!emoji)}><Smile /></button>
                {emoji && <div className="emoji"><EmojiPicker onEmojiClick={(selectedEmoji) => { setText((current) => current + selectedEmoji.emoji); setEmoji(false); }} /></div>}
                <textarea placeholder={status === 'offline' ? 'Write a message — it will be queued' : 'Write a message'} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} />
                <button className={recorder.current ? 'recording' : ''} onClick={voice}><Mic /></button>
                <button className="send" onClick={send}><Send /></button>
              </footer>
            )}
          </>
        ) : (
          <div className="empty"><img src="/icon.svg" alt="Verdant" /><h2>Your conversations, naturally connected.</h2><p>Select a chat or create a new one.</p></div>
        )}
      </main>

      {showNew && <NewChat onClose={() => setShowNew(false)} onCreated={handleChatCreated} />}
      {showShare && activeChat?.type === 'rss' && <RssShareModal chat={activeChat} onClose={() => setShowShare(false)} />}
    </div>
  );
}

function NewChat({ onClose, onCreated }) {
  const [type, setType] = useState('direct');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState('');
  const [rss, setRss] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setUsers([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/api/users/search?q=${encodeURIComponent(query.trim())}`)
        .then((data) => { if (!cancelled) setUsers(data.users || []); })
        .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  async function create(selectedUser) {
    if (busy) return;
    setError('');
    try {
      setBusy(true);
      let data;
      if (type === 'direct') {
        if (!selectedUser) throw new Error('Select a user first');
        data = await api('/api/chats/direct', { method: 'POST', body: JSON.stringify({ userId: selectedUser.id }) });
      } else if (type === 'group') {
        if (!selectedUser) throw new Error('Select at least one member');
        if (!title.trim()) throw new Error('Enter a group title');
        data = await api('/api/chats/group', { method: 'POST', body: JSON.stringify({ title: title.trim(), memberIds: [selectedUser.id] }) });
      } else {
        const feedUrl = rss.trim();
        if (!feedUrl) throw new Error('Enter an RSS or Atom feed URL');
        const parsedUrl = new URL(feedUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('RSS URL must use http or https');
        data = await api('/api/chats/rss', { method: 'POST', body: JSON.stringify({ title: title.trim(), url: parsedUrl.toString() }) });
      }
      await onCreated(data?.chat);
    } catch (requestError) {
      setError(requestError.message === 'Invalid URL' ? 'Enter a valid RSS or Atom feed URL' : requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <section>
        <header><h3>New conversation</h3><button onClick={onClose}><X /></button></header>
        <div className="tabs">{['direct', 'group', 'rss'].map((item) => <button key={item} className={type === item ? 'active' : ''} onClick={() => { setType(item); setError(''); }}>{item}</button>)}</div>
        {type === 'rss' ? (
          <>
            <input placeholder="Channel title (optional)" value={title} onChange={(event) => setTitle(event.target.value)} />
            <input type="url" inputMode="url" placeholder="https://example.com/feed.xml" value={rss} onChange={(event) => setRss(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') create(); }} />
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={busy} onClick={() => create()}>{busy ? 'Checking feed…' : 'Add RSS channel'}</button>
          </>
        ) : (
          <>
            <input placeholder="Search username or mobile" value={query} onChange={(event) => setQuery(event.target.value)} />
            {type === 'group' && <input placeholder="Group title" value={title} onChange={(event) => setTitle(event.target.value)} />}
            {error && <p className="error">{error}</p>}
            <div className="results">{users.map((candidate) => <button key={candidate.id} disabled={busy} onClick={() => create(candidate)}><Avatar entity={candidate} /><span><b>{candidate.displayName || candidate.username}</b><small>@{candidate.username} · {candidate.mobile}</small></span></button>)}</div>
          </>
        )}
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
