import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Check,
  ExternalLink,
  FileUp,
  Images,
  Menu,
  Mic,
  MoreVertical,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  Smile,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { api, getToken, setToken } from './api';
import { apiOrigin, socketOrigin } from './runtime';
import { cacheChats, enqueue, offlineDb, queued } from './offline';
import { loadRssFeed } from './rss-client';
import { SidebarAccount } from './sidebar-account';
import { ErrorBoundary } from './error-boundary';
import { AccountMenu } from './account-menu';
import { MobileNav } from './mobile-nav';
import { showIncomingNotification } from './app-tools';
import {
  MediaGallery,
  ReplyComposer,
  VirtualMessageList,
} from './chat-features';
import './styles.css';
import './mobile-ui.css';

function resolveAssetUrl(value) {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? `${apiOrigin}${value}` : value;
}

function displayName(entity, fallback = 'Conversation') {
  return entity?.displayName || entity?.title || entity?.username || fallback;
}

function initials(entity) {
  return displayName(entity, 'C').trim().slice(0, 2).toUpperCase();
}

function formatPresence(peer) {
  if (!peer) return '';
  if (peer.isOnline) return 'online';
  if (peer.hidePresence) return 'last seen hidden';
  if (!peer.lastSeenAt) return 'offline';
  const date = new Date(peer.lastSeenAt);
  return Number.isNaN(date.getTime()) ? 'offline' : `last seen ${date.toLocaleString()}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
}

function Avatar({ entity, icon, className = '' }) {
  const source = resolveAssetUrl(entity?.avatarUrl);
  return (
    <span className={`avatar ${className}`}>
      {source ? <img src={source} alt={displayName(entity)} onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : icon || initials(entity)}
    </span>
  );
}

function ConnectionNotice({ status }) {
  if (status === 'connected') return null;
  return (
    <div className={`connection-notice ${status}`}>
      <WifiOff />
      <span>{status === 'offline' ? 'Disconnected. New messages will be queued.' : 'Updating connection…'}</span>
    </div>
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
        <div className="brand"><img src="/icon.svg" alt="Verdant" /><div><b>Verdant</b><span>Calm conversations, everywhere.</span></div></div>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <form onSubmit={submit}>
          {mode === 'register' && <><label>Username<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label><label>Mobile number<input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} /></label></>}
          {mode === 'login' && <label>Username or mobile<input value={form.identity} onChange={(event) => setForm({ ...form, identity: event.target.value })} /></label>}
          <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary">{mode === 'login' ? 'Sign in' : 'Register'}</button>
        </form>
        <button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Already have an account?'}</button>
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

  useEffect(() => {
    if (query.trim().length < 2) { setUsers([]); return undefined; }
    const timer = setTimeout(() => api(`/api/users/search?q=${encodeURIComponent(query.trim())}`).then((data) => setUsers(data.users || [])).catch((requestError) => setError(requestError.message)), 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function share(payload) {
    try {
      setBusy(true);
      setError('');
      await api(`/api/v2/chats/${chat.id}/share`, { method: 'POST', body: JSON.stringify(payload) });
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal"><section className="share-modal"><header><div><h3>Share RSS channel</h3><small>{chat.title}</small></div><button onClick={onClose}><X /></button></header><button className="share-everyone" disabled={busy} onClick={() => share({ all: true })}><Users />Share with everyone</button><div className="modal-divider"><span>or choose users</span></div><div className="search share-search"><Search /><input placeholder="Search users" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="share-users">{users.map((candidate) => <button key={candidate.id} className={selected.has(candidate.id) ? 'selected' : ''} onClick={() => setSelected((current) => { const next = new Set(current); next.has(candidate.id) ? next.delete(candidate.id) : next.add(candidate.id); return next; })}><Avatar entity={candidate} /><span><b>{candidate.displayName || candidate.username}</b><small>@{candidate.username}</small></span><span className="share-check">{selected.has(candidate.id) && <Check />}</span></button>)}</div>{error && <p className="error">{error}</p>}<button className="primary" disabled={busy || !selected.size} onClick={() => share({ userIds: [...selected] })}>Share with selected ({selected.size})</button></section></div>
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
    const timer = setTimeout(() => api(`/api/users/search?q=${encodeURIComponent(query.trim())}`).then((data) => setUsers(data.users || [])).catch((requestError) => setError(requestError.message)), 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function create(selectedUser) {
    try {
      setBusy(true);
      setError('');
      let data;
      if (type === 'direct') data = await api('/api/chats/direct', { method: 'POST', body: JSON.stringify({ userId: selectedUser.id }) });
      else if (type === 'group') data = await api('/api/chats/group', { method: 'POST', body: JSON.stringify({ title: title.trim(), memberIds: [selectedUser.id] }) });
      else data = await api('/api/v2/rss', { method: 'POST', body: JSON.stringify({ title: title.trim(), url: new URL(rss.trim()).toString() }) });
      onCreated(data.chat);
    } catch (requestError) {
      setError(requestError.message || 'Conversation could not be created');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal"><section><header><h3>New conversation</h3><button onClick={onClose}><X /></button></header><div className="tabs">{['direct', 'group', 'rss'].map((item) => <button key={item} className={type === item ? 'active' : ''} onClick={() => setType(item)}>{item}</button>)}</div>{type === 'rss' ? <><input placeholder="Channel title (optional)" value={title} onChange={(event) => setTitle(event.target.value)} /><input placeholder="https://example.com/feed.xml" value={rss} onChange={(event) => setRss(event.target.value)} />{error && <p className="error">{error}</p>}<button className="primary" disabled={busy} onClick={() => create()}>Add RSS channel</button></> : <><input placeholder="Search username or mobile" value={query} onChange={(event) => setQuery(event.target.value)} />{type === 'group' && <input placeholder="Group title" value={title} onChange={(event) => setTitle(event.target.value)} />}{error && <p className="error">{error}</p>}<div className="results">{users.map((candidate) => <button key={candidate.id} disabled={busy} onClick={() => create(candidate)}><Avatar entity={candidate} /><span><b>{candidate.displayName || candidate.username}</b><small>@{candidate.username}</small></span></button>)}</div></>}</section></div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState(navigator.onLine ? 'updating' : 'offline');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showFab, setShowFab] = useState(true);
  const [feedError, setFeedError] = useState('');

  const socket = useRef(null);
  const file = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const activeIdRef = useRef(null);
  const chatsRef = useRef([]);
  const chatListRef = useRef(null);
  const activeChat = chats.find((chat) => chat.id === active?.id) || active;
  const unreadTotal = useMemo(() => chats.reduce((total, chat) => total + Number(chat.unreadCount || 0), 0), [chats]);

  useEffect(() => { activeIdRef.current = active?.id || null; }, [active?.id]);
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { if (getToken()) api('/api/me').then((data) => setUser(data.user)).catch(() => setToken(null)); }, []);

  function upsertMessage(message) {
    setMessages((current) => {
      const found = current.findIndex((item) => Number(item.id) === Number(message.id) || (message.clientId && item.clientId === message.clientId));
      if (found === -1) return [...current, message];
      const next = [...current];
      next[found] = { ...next[found], ...message };
      return next;
    });
  }

  useEffect(() => {
    if (!user) return undefined;
    loadChats();
    const currentSocket = io(socketOrigin, { auth: { token: getToken() }, reconnection: true });
    socket.current = currentSocket;
    currentSocket.on('connect', () => { setStatus('connected'); flush(currentSocket); });
    currentSocket.on('disconnect', () => setStatus(navigator.onLine ? 'updating' : 'offline'));
    currentSocket.on('connect_error', () => setStatus(navigator.onLine ? 'updating' : 'offline'));
    currentSocket.on('chat:new', (chat) => setChats((current) => [{ ...chat, unreadCount: Number(chat.unreadCount || 0) }, ...current.filter((item) => item.id !== chat.id)]));
    currentSocket.on('message:new', (message) => {
      const isActive = Number(activeIdRef.current) === Number(message.chatId);
      const relatedChat = chatsRef.current.find((chat) => Number(chat.id) === Number(message.chatId));
      if (message.senderId !== user.id && !relatedChat?.muted && (!isActive || document.hidden)) showIncomingNotification({ title: relatedChat?.title || 'New message', body: message.body || message.fileName || 'Attachment', icon: resolveAssetUrl(relatedChat?.avatarUrl), tag: `chat-${message.chatId}` }).catch(() => {});
      if (isActive) upsertMessage(message);
      setChats((current) => { const found = current.find((chat) => Number(chat.id) === Number(message.chatId)); if (!found) return current; const updated = { ...found, updatedAt: message.createdAt || new Date().toISOString(), unreadCount: isActive || message.senderId === user.id ? 0 : Number(found.unreadCount || 0) + 1 }; return [updated, ...current.filter((chat) => Number(chat.id) !== Number(message.chatId))]; });
    });
    currentSocket.on('message:updated', upsertMessage);
    currentSocket.on('message:deleted', ({ id, deletedAt }) => setMessages((current) => current.map((message) => Number(message.id) === Number(id) ? { ...message, type: 'deleted', body: null, fileUrl: null, mimeType: null, deletedAt, reactions: [] } : message)));
    currentSocket.on('message:reactions', ({ messageId, reactions }) => setMessages((current) => current.map((message) => Number(message.id) === Number(messageId) ? { ...message, reactions } : message)));
    const timer = setInterval(loadChats, 20000);
    const onlineHandler = () => setStatus(currentSocket.connected ? 'connected' : 'updating');
    const offlineHandler = () => setStatus('offline');
    addEventListener('online', onlineHandler);
    addEventListener('offline', offlineHandler);
    return () => { clearInterval(timer); currentSocket.close(); removeEventListener('online', onlineHandler); removeEventListener('offline', offlineHandler); };
  }, [user?.id]);

  async function loadChats() {
    try {
      const data = await api('/api/v2/chats');
      setChats(data.chats || []);
      await cacheChats(data.chats || []);
    } catch {
      setChats(await offlineDb.chats.orderBy('updatedAt').reverse().toArray());
    }
  }

  async function loadPage(chatId, before = null, prepend = false) {
    const params = new URLSearchParams({ limit: '40' });
    if (before) params.set('before', before);
    const data = await api(`/api/v2/chats/${chatId}/messages/page?${params}`);
    setMessages((current) => prepend ? [...data.messages, ...current.filter((message) => !data.messages.some((item) => item.id === message.id))] : data.messages);
    setCursor(data.nextCursor);
    setHasMore(data.hasMore);
  }

  async function openChat(chat) {
    setActive(chat);
    setMessages([]);
    setReplyTo(null);
    setFeedError('');
    setShowGallery(false);
    setChats((current) => current.map((item) => item.id === chat.id ? { ...item, unreadCount: 0 } : item));
    try {
      if (chat.type === 'rss') setMessages((await loadRssFeed(chat.rssUrl)).items);
      else await loadPage(chat.id);
    } catch (requestError) {
      setFeedError(requestError.message);
    }
  }

  async function loadOlder() {
    if (!activeChat || !cursor || loadingOlder) return;
    try { setLoadingOlder(true); await loadPage(activeChat.id, cursor, true); } finally { setLoadingOlder(false); }
  }

  async function send() {
    if (!activeChat || !text.trim()) return;
    if (status !== 'connected') {
      const queuedMessage = { clientId: crypto.randomUUID(), chatId: activeChat.id, body: text.trim(), senderId: user.id, replyToId: replyTo?.id, createdAt: new Date().toISOString(), status: 'queued' };
      await enqueue(queuedMessage);
      upsertMessage(queuedMessage);
    } else {
      const data = await api(`/api/v2/chats/${activeChat.id}/messages`, { method: 'POST', body: JSON.stringify({ clientId: crypto.randomUUID(), body: text.trim(), replyToId: replyTo?.id || null }) });
      upsertMessage(data.message);
    }
    setText('');
    setReplyTo(null);
  }

  async function flush() {
    for (const message of await queued()) {
      try {
        const data = await api(`/api/v2/chats/${message.chatId}/messages`, { method: 'POST', body: JSON.stringify({ clientId: message.clientId, body: message.body, replyToId: message.replyToId || null }) });
        upsertMessage(data.message);
        await offlineDb.outbox.delete(message.clientId);
      } catch {
        await offlineDb.outbox.update(message.clientId, { status: 'failed' });
      }
    }
  }

  async function editMessage(message) {
    const body = window.prompt('Edit message', message.body || '');
    if (!body || body.trim() === message.body) return;
    const data = await api(`/api/v2/messages/${message.id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
    upsertMessage(data.message);
  }

  async function deleteMessage(message) {
    if (!window.confirm('Delete this message?')) return;
    await api(`/api/v2/messages/${message.id}`, { method: 'DELETE' });
  }

  async function reactMessage(message, emoji) {
    const data = await api(`/api/v2/messages/${message.id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) });
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, reactions: data.reactions } : item));
  }

  async function updatePreference(key) {
    if (!activeChat) return;
    const value = !activeChat[key];
    const data = await api(`/api/v2/chats/${activeChat.id}/preferences`, { method: 'PATCH', body: JSON.stringify({ [key]: value }) });
    setChats((current) => current.map((chat) => chat.id === activeChat.id ? { ...chat, ...data.preferences } : chat));
    if (key === 'archived' && value) setActive(null);
  }

  async function uploadFile(blob, name, type = 'file') {
    const formData = new FormData();
    formData.append('file', blob, name);
    formData.append('clientId', crypto.randomUUID());
    formData.append('type', type);
    await api(`/api/chats/${activeChat.id}/files`, { method: 'POST', body: formData });
  }

  async function voice() {
    if (recorder.current) { recorder.current.stop(); recorder.current = null; return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    chunks.current = [];
    mediaRecorder.ondataavailable = (event) => chunks.current.push(event.data);
    mediaRecorder.onstop = () => { uploadFile(new Blob(chunks.current, { type: 'audio/webm' }), `voice-${Date.now()}.webm`, 'voice'); stream.getTracks().forEach((track) => track.stop()); };
    mediaRecorder.start();
    recorder.current = mediaRecorder;
  }

  function exportHtml() {
    const html = `<!doctype html><meta charset="utf-8"><title>${activeChat.title}</title><h1>${activeChat.title}</h1>${messages.map((message) => `<article><p>${message.deletedAt ? 'Message deleted' : message.body || message.fileName || ''}</p><small>${formatDate(message.createdAt)}</small></article>`).join('')}`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `verdant-chat-${activeChat.id}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!user) return <Auth onDone={setUser} />;

  const filteredChats = chats.filter((chat) => Boolean(chat.archived) === showArchived && (chat.title || chat.type).toLowerCase().includes(query.toLowerCase()));
  const openProfile = () => document.querySelector('.account-user-launch')?.click();
  const openAdmin = () => document.querySelector('.account-launcher button[title="Administration"]')?.click();

  return (
    <div className="app">
      <aside className={activeChat ? 'sidebar mobile-hidden' : 'sidebar'}>
        <header><div className="brand compact"><img src="/icon.svg" alt="Verdant" /><b>Verdant</b></div><div className="sidebar-header-actions"><button className="desktop-new-chat" onClick={() => setShowNew(true)}><Plus /></button><SidebarAccount user={user} onOpen={() => setShowAccountMenu(true)} /></div></header>
        <ConnectionNotice status={status} />
        <div className="search"><Search /><input placeholder="Search chats" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="chat-state-tabs"><button className={!showArchived ? 'active' : ''} onClick={() => setShowArchived(false)}>Chats</button><button className={showArchived ? 'active' : ''} onClick={() => setShowArchived(true)}>Archived</button></div>
        <div className="chat-list" ref={chatListRef} onScroll={(event) => setShowFab(event.currentTarget.scrollTop <= 8)}>
          {filteredChats.map((chat) => <button key={chat.id} className={activeChat?.id === chat.id ? 'chat active' : 'chat'} onClick={() => openChat(chat)}><Avatar entity={chat} icon={chat.type === 'group' ? <Users /> : chat.type === 'rss' ? <Archive /> : null} /><span className="chat-copy"><b>{chat.title || `${chat.type} chat`}</b><small>{chat.type === 'direct' ? formatPresence(chat.peer) : chat.type === 'rss' ? 'RSS channel' : 'Group conversation'}</small></span><span className="chat-flags">{chat.pinned && <Pin />}{chat.muted && <VolumeX />}</span>{Number(chat.unreadCount || 0) > 0 && <span className="unread-badge">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>}</button>)}
        </div>
      </aside>

      <main className={activeChat ? 'conversation' : 'conversation mobile-hidden'}>
        {activeChat ? <><header className="conversation-head"><button className="mobile-back" onClick={() => setActive(null)}><Menu /></button><Avatar entity={activeChat} icon={activeChat.type === 'group' ? <Users /> : activeChat.type === 'rss' ? <Archive /> : null} className="head-avatar" /><div className="conversation-title"><b>{activeChat.title}</b>{activeChat.type === 'direct' && <small>{formatPresence(activeChat.peer)}</small>}</div><div className="head-actions"><button onClick={exportHtml}><Archive /></button><div className="conversation-actions"><button onClick={() => setShowActions((value) => !value)}><MoreVertical /></button>{showActions && <div className="conversation-menu"><button onClick={() => openChat(activeChat)}><RefreshCw />Refresh</button><button className={activeChat.pinned ? 'chat-preference-button active' : ''} onClick={() => updatePreference('pinned')}>{activeChat.pinned ? <PinOff /> : <Pin />}{activeChat.pinned ? 'Unpin' : 'Pin'}</button><button className={activeChat.muted ? 'chat-preference-button active' : ''} onClick={() => updatePreference('muted')}>{activeChat.muted ? <Volume2 /> : <VolumeX />}{activeChat.muted ? 'Unmute' : 'Mute'}</button><button onClick={() => updatePreference('archived')}>{activeChat.archived ? <ArchiveRestore /> : <Archive />}{activeChat.archived ? 'Unarchive' : 'Archive'}</button>{activeChat.type !== 'rss' && <button onClick={() => { setShowActions(false); setShowGallery(true); }}><Images />Media gallery</button>}{activeChat.type === 'rss' && <button onClick={() => setShowShare(true)}><Share2 />Share RSS</button>}<button className="danger" onClick={() => api(`/api/chats/${activeChat.id}`, { method: 'DELETE' }).then(() => { setChats((current) => current.filter((chat) => chat.id !== activeChat.id)); setActive(null); })}><Trash2 />Hide conversation</button></div>}</div></div></header><ConnectionNotice status={status} />{feedError && <div className="conversation-error"><span>{feedError}</span><button onClick={() => setFeedError('')}><X /></button></div>}{activeChat.type === 'rss' ? <section className="messages rss-messages">{messages.map((message, index) => <article className="rss-card" key={message.id || index}>{message.imageUrl && <a href={message.link} target="_blank" rel="noreferrer" className="rss-image"><img src={message.imageUrl} alt={message.title} /></a>}<div className="rss-content"><div className="rss-meta"><span><CalendarDays />{formatDate(message.createdAt)}</span>{message.author && <span>{message.author}</span>}</div><h3>{message.title}</h3><p>{message.body}</p>{message.link && <a className="rss-link" href={message.link} target="_blank" rel="noreferrer">Read article <ExternalLink /></a>}</div></article>)}</section> : <VirtualMessageList messages={messages} user={user} hasMore={hasMore} loadingOlder={loadingOlder} onLoadOlder={loadOlder} onReply={setReplyTo} onEdit={editMessage} onDelete={deleteMessage} onReact={reactMessage} onOpenMedia={() => setShowGallery(true)} />}{activeChat.type !== 'rss' && <footer className="composer"><ReplyComposer message={replyTo} onCancel={() => setReplyTo(null)} /><input ref={file} type="file" hidden onChange={(event) => { const selected = event.target.files?.[0]; if (selected) uploadFile(selected, selected.name); event.target.value = ''; }} /><button onClick={() => file.current?.click()}><FileUp /></button><button onClick={() => setEmojiOpen((value) => !value)}><Smile /></button>{emojiOpen && <div className="emoji"><EmojiPicker onEmojiClick={(value) => { setText((current) => current + value.emoji); setEmojiOpen(false); }} /></div>}<textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder={status === 'offline' ? 'Message will be queued' : 'Write a message'} /><button onClick={voice}><Mic /></button><button className="send" onClick={send}><Send /></button></footer>}</> : <div className="empty"><img src="/icon.svg" alt="Verdant" /><h2>Your conversations, naturally connected.</h2><p>Select a chat or create a new one.</p></div>}
      </main>

      {!activeChat && <MobileNav unreadCount={unreadTotal} showFab={showFab} onChats={() => { setShowArchived(false); chatListRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} onProfile={() => setShowAccountMenu(true)} onNewChat={() => setShowNew(true)} />}
      {showAccountMenu && <AccountMenu user={user} onClose={() => setShowAccountMenu(false)} onProfile={openProfile} onAdmin={openAdmin} onLogout={() => { setToken(null); location.reload(); }} />}
      {showNew && <NewChat onClose={() => setShowNew(false)} onCreated={(chat) => { setShowNew(false); setChats((current) => [chat, ...current]); openChat(chat); }} />}
      {showShare && <RssShareModal chat={activeChat} onClose={() => setShowShare(false)} />}
      {showGallery && <MediaGallery chat={activeChat} onClose={() => setShowGallery(false)} />}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
