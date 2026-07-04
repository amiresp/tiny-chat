import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import {
  Archive,
  FileUp,
  LogOut,
  Menu,
  Mic,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smile,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api, getToken, setToken } from './api';
import { cacheChats, cacheMessages, enqueue, offlineDb, queued } from './offline';
import './styles.css';

const socketUrl = import.meta.env.VITE_SOCKET_URL || location.origin;

function Auth({ onDone }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', mobile: '', identity: '', password: '' });
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    try {
      setError('');
      const data = await api(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
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
          <div>
            <b>Verdant</b>
            <span>Calm conversations, everywhere.</span>
          </div>
        </div>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label>
                Username
                <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
              </label>
              <label>
                Mobile number
                <input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} />
              </label>
            </>
          )}
          {mode === 'login' && (
            <label>
              Username or mobile
              <input value={form.identity} onChange={(event) => setForm({ ...form, identity: event.target.value })} />
            </label>
          )}
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
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

  const socket = useRef(null);
  const file = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const actionsRef = useRef(null);

  useEffect(() => {
    if (!getToken()) return;
    api('/api/me').then((data) => setUser(data.user)).catch(() => setToken(null));
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    loadChats();
    const currentSocket = io(socketUrl, { auth: { token: getToken() } });
    socket.current = currentSocket;
    currentSocket.on('connect', () => {
      setStatus('connected');
      flush(currentSocket);
    });
    currentSocket.on('disconnect', () => setStatus(navigator.onLine ? 'connecting' : 'offline'));
    currentSocket.on('message:new', (message) => {
      setMessages((current) => active?.id === message.chatId ? [...current.filter((item) => item.clientId !== message.clientId), message] : current);
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
  }, [user, active?.id]);

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
      const data = await api('/api/chats');
      setChats(data.chats);
      cacheChats(data.chats);
    } catch {
      setChats(await offlineDb.chats.toArray());
    }
  }

  async function openChat(chat) {
    setActive(chat);
    setShowNew(false);
    setShowActions(false);
    try {
      const data = await api(`/api/chats/${chat.id}/messages`);
      const list = data.messages || data.items || [];
      setMessages(list);
      if (!data.rss) cacheMessages(chat.id, list);
    } catch (requestError) {
      if (chat.type === 'rss') {
        setMessages([]);
        alert(requestError.message);
        return;
      }
      setMessages(await offlineDb.messages.where('chatId').equals(chat.id).sortBy('createdAt'));
    }
  }

  async function refreshActiveChat() {
    if (!active) return;
    await openChat(active);
  }

  async function hideActiveChat() {
    if (!active) return;
    const confirmed = window.confirm(active.type === 'rss' ? 'Remove this RSS channel from your conversations?' : 'Hide this conversation? It will be removed from your list.');
    if (!confirmed) return;

    try {
      await api(`/api/chats/${active.id}`, { method: 'DELETE' });
      setShowActions(false);
      setActive(null);
      setMessages([]);
      await loadChats();
    } catch (requestError) {
      alert(requestError.message);
    }
  }

  async function flush(currentSocket = socket.current) {
    for (const message of await queued()) {
      await offlineDb.outbox.update(message.clientId, { status: 'sending' });
      currentSocket.emit('message:send', message, async (result) => {
        await offlineDb.outbox.update(message.clientId, { status: result.ok ? 'sent' : 'failed' });
        if (result.ok) await offlineDb.outbox.delete(message.clientId);
      });
    }
  }

  async function send() {
    if (!text.trim() || !active) return;
    const message = {
      clientId: crypto.randomUUID(),
      chatId: active.id,
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
    if (!active) return;
    if (blob.size > 50 * 1024 * 1024) {
      alert('Maximum file size is 50 MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', blob, name);
    formData.append('clientId', crypto.randomUUID());
    formData.append('type', type);
    try {
      await api(`/api/chats/${active.id}/files`, { method: 'POST', body: formData });
      openChat(active);
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
    if (!active) return;
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const body = messages.map((message) => `<article><b>${escapeHtml(message.senderId === user.id ? user.username : 'Member')}</b><time>${new Date(message.createdAt).toLocaleString()}</time><p>${escapeHtml(message.body || message.title || '')}</p>${message.fileUrl ? `<a href="${escapeHtml(message.fileUrl)}">${escapeHtml(message.fileName || 'Download file')}</a>` : ''}${message.link ? `<a href="${escapeHtml(message.link)}">Open source</a>` : ''}</article>`).join('');
    const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(active.title || 'Chat export')}</title><style>body{font:16px system-ui;max-width:800px;margin:auto;padding:30px}article{border-bottom:1px solid #ddd;padding:16px}time{float:right;color:#777}a{display:block}</style><h1>${escapeHtml(active.title || 'Conversation')}</h1>${body}`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `verdant-chat-${active.id}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  if (!user) return <Auth onDone={setUser} />;

  const filtered = chats.filter((chat) => (chat.title || chat.type).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app">
      <aside className={active ? 'sidebar mobile-hidden' : 'sidebar'}>
        <header>
          <div className="brand compact">
            <img src="/icon.svg" alt="Verdant" />
            <b>Verdant</b>
          </div>
          <button title="New conversation" onClick={() => setShowNew(true)}><Plus /></button>
        </header>
        <div className="search">
          <Search />
          <input placeholder="Search chats" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="chat-list">
          {filtered.map((chat) => (
            <button key={chat.id} className={active?.id === chat.id ? 'chat active' : 'chat'} onClick={() => openChat(chat)}>
              <span className="avatar">{chat.type === 'group' ? <Users /> : chat.type === 'rss' ? <Archive /> : (chat.title || 'C')[0]}</span>
              <span>
                <b>{chat.title || `${chat.type} chat`}</b>
                <small>{chat.type === 'rss' ? 'Refreshes when opened' : 'Open conversation'}</small>
              </span>
            </button>
          ))}
        </div>
        <footer>
          <span className={`dot ${status}`} />
          <span>{status}</span>
          <button title="Sign out" onClick={() => { setToken(null); location.reload(); }}><LogOut /></button>
        </footer>
      </aside>

      <main className={active ? 'conversation' : 'conversation mobile-hidden'}>
        {active ? (
          <>
            <header className="conversation-head">
              <button className="mobile-back" onClick={() => setActive(null)}><Menu /></button>
              <div>
                <b>{active.title || `${active.type} chat`}</b>
                <small>{status}</small>
              </div>
              <div className="head-actions">
                <button title="Export HTML" onClick={exportHtml}><Archive /></button>
                <div className="conversation-actions" ref={actionsRef}>
                  <button title="Conversation actions" aria-haspopup="menu" aria-expanded={showActions} onClick={() => setShowActions((current) => !current)}><MoreVertical /></button>
                  {showActions && (
                    <div className="conversation-menu" role="menu">
                      <button role="menuitem" onClick={refreshActiveChat}><RefreshCw />Refresh</button>
                      <button className="danger" role="menuitem" onClick={hideActiveChat}><Trash2 />{active.type === 'rss' ? 'Remove RSS channel' : 'Hide conversation'}</button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <section className="messages">
              {messages.map((message, index) => (
                <div key={message.id || message.clientId || index} className={`bubble ${message.senderId === user.id ? 'mine' : ''}`}>
                  <p>{message.body || message.title}</p>
                  {message.mimeType?.startsWith('image/') && message.fileUrl && <img src={message.fileUrl} alt={message.fileName || 'Shared file'} />}
                  {message.mimeType?.startsWith('video/') && message.fileUrl && <video controls src={message.fileUrl} />}
                  {message.type === 'voice' && message.fileUrl && <audio controls src={message.fileUrl} />}
                  {message.fileExpired && <small>File expired</small>}
                  {message.fileUrl && !message.mimeType?.match(/^(image|video|audio)\//) && <a href={message.fileUrl}>{message.fileName || 'Download file'}</a>}
                  {message.link && <a target="_blank" rel="noreferrer" href={message.link}>Open article</a>}
                  <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {message.status && `· ${message.status}`}</time>
                </div>
              ))}
            </section>

            {active.type !== 'rss' && (
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
          <div className="empty">
            <img src="/icon.svg" alt="Verdant" />
            <h2>Your conversations, naturally connected.</h2>
            <p>Select a chat or create a new one.</p>
          </div>
        )}
      </main>

      {showNew && <NewChat onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); loadChats(); }} />}
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
    if (query.trim().length < 2) {
      setUsers([]);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/api/users/search?q=${encodeURIComponent(query.trim())}`)
        .then((data) => { if (!cancelled) setUsers(data.users); })
        .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function create(selectedUser) {
    if (busy) return;
    setError('');

    try {
      setBusy(true);
      if (type === 'direct') {
        if (!selectedUser) throw new Error('Select a user first');
        await api('/api/chats/direct', { method: 'POST', body: JSON.stringify({ userId: selectedUser.id }) });
      } else if (type === 'group') {
        if (!selectedUser) throw new Error('Select at least one member');
        if (!title.trim()) throw new Error('Enter a group title');
        await api('/api/chats/group', { method: 'POST', body: JSON.stringify({ title: title.trim(), memberIds: [selectedUser.id] }) });
      } else {
        const feedUrl = rss.trim();
        if (!feedUrl) throw new Error('Enter an RSS or Atom feed URL');
        let parsedUrl;
        try {
          parsedUrl = new URL(feedUrl);
        } catch {
          throw new Error('Enter a valid RSS or Atom feed URL');
        }
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('RSS URL must use http or https');
        await api('/api/chats/rss', { method: 'POST', body: JSON.stringify({ title: title.trim(), url: parsedUrl.toString() }) });
      }
      onCreated();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <section>
        <header>
          <h3>New conversation</h3>
          <button title="Close" onClick={onClose}><X /></button>
        </header>
        <div className="tabs">
          {['direct', 'group', 'rss'].map((item) => (
            <button key={item} className={type === item ? 'active' : ''} onClick={() => { setType(item); setError(''); }}>{item}</button>
          ))}
        </div>

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
            <div className="results">
              {users.map((candidate) => (
                <button key={candidate.id} disabled={busy} onClick={() => create(candidate)}>
                  <span className="avatar">{candidate.username[0]}</span>
                  <span><b>{candidate.displayName || candidate.username}</b><small>@{candidate.username} · {candidate.mobile}</small></span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
