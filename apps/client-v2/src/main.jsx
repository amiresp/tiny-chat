import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import {
  IonActionSheet,
  IonApp,
  IonAvatar,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonFooter,
  IonHeader,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonLoading,
  IonModal,
  IonPage,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToggle,
  IonToolbar,
  setupIonicReact,
} from '@ionic/react';
import {
  Bookmark,
  Copy,
  FileText,
  Image,
  Info,
  LogOut,
  Paperclip,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { api, assetUrl, getToken, setToken } from './api';
import { socketOrigin, apiOrigin } from './runtime';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import './theme.css';

setupIonicReact({ mode: 'ios' });

function initials(entity) {
  return String(entity?.displayName || entity?.title || entity?.username || 'V').trim().slice(0, 2).toUpperCase();
}

function titleOf(entity) {
  return entity?.displayName || entity?.title || entity?.username || 'Verdant';
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function snippet(message) {
  return message?.body || message?.fileName || message?.title || 'Attachment';
}

function Avatar({ entity, icon }) {
  const source = assetUrl(entity?.avatarUrl);
  return <IonAvatar className="vc-avatar">{source ? <img src={source} alt={titleOf(entity)} /> : <span>{icon || initials(entity)}</span>}</IonAvatar>;
}

function AuthPage({ onDone }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', mobile: '', identity: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  async function submit(event) {
    event.preventDefault();
    try {
      setBusy(true);
      const data = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      setToken(data.token);
      onDone(data.user);
    } catch (error) {
      setToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <IonPage><IonContent fullscreen className="auth-page"><form className="auth-card" onSubmit={submit}><img src="/icon.svg" alt="Verdant" /><h1>Verdant Chat</h1><p>Clean, calm, mobile-first messaging.</p>{mode === 'register' && <><IonInput label="Username" labelPlacement="stacked" value={form.username} onIonInput={(e) => setForm({ ...form, username: e.detail.value || '' })} /><IonInput label="Mobile" labelPlacement="stacked" value={form.mobile} onIonInput={(e) => setForm({ ...form, mobile: e.detail.value || '' })} /></>}{mode === 'login' && <IonInput label="Username or mobile" labelPlacement="stacked" value={form.identity} onIonInput={(e) => setForm({ ...form, identity: e.detail.value || '' })} />}<IonInput label="Password" labelPlacement="stacked" type="password" value={form.password} onIonInput={(e) => setForm({ ...form, password: e.detail.value || '' })} /><IonButton expand="block" type="submit" disabled={busy}>{mode === 'login' ? 'Sign in' : 'Create account'}</IonButton><IonButton fill="clear" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create account' : 'Back to sign in'}</IonButton></form></IonContent><IonLoading isOpen={busy} message="Please wait…" /><IonToast isOpen={Boolean(toast)} message={toast} duration={2600} onDidDismiss={() => setToast('')} /></IonPage>;
}

function ChatList({ chats, activeId, query, setQuery, filter, setFilter, onOpen, onNew, onRefresh, onSettings }) {
  const list = chats.filter((chat) => Boolean(chat.archived) === (filter === 'archived') && (chat.title || '').toLowerCase().includes(query.toLowerCase()));
  return <IonPage className="chat-list-page"><IonHeader translucent><IonToolbar><IonTitle>Verdant</IonTitle><IonButtons slot="end"><IonButton onClick={onSettings}><Settings size={19} /></IonButton><IonButton onClick={onNew}><Plus size={20} /></IonButton></IonButtons></IonToolbar><IonToolbar className="search-toolbar"><IonSearchbar debounce={180} value={query} placeholder="Search chats" onIonInput={(e) => setQuery(e.detail.value || '')} /></IonToolbar><IonToolbar><IonSegment value={filter} onIonChange={(e) => setFilter(e.detail.value)}><IonSegmentButton value="active">Chats</IonSegmentButton><IonSegmentButton value="archived">Archived</IonSegmentButton></IonSegment></IonToolbar></IonHeader><IonContent><IonRefresher slot="fixed" onIonRefresh={async (e) => { await onRefresh(); e.detail.complete(); }}><IonRefresherContent /></IonRefresher><IonList lines="none" className="chat-list">{list.map((chat) => <IonItemSliding key={chat.id}><IonItem button detail={false} className={Number(activeId) === Number(chat.id) ? 'chat-row active' : 'chat-row'} onClick={() => onOpen(chat)}><Avatar entity={chat} icon={chat.type === 'saved' ? '★' : chat.type === 'group' ? 'G' : chat.type === 'rss' ? 'R' : undefined} /><IonLabel><h2>{chat.title || `${chat.type} chat`}</h2><p>{chat.type === 'direct' ? (chat.peer?.isOnline ? 'online' : 'direct message') : chat.type === 'saved' ? 'Private saved messages' : chat.type === 'rss' ? 'RSS channel' : 'Group conversation'}</p></IonLabel>{chat.pinned && <Pin size={15} className="mini-icon" />}{Number(chat.unreadCount || 0) > 0 && <IonBadge color="success">{chat.unreadCount}</IonBadge>}</IonItem><IonItemOptions side="end"><IonItemOption color="medium">Archive</IonItemOption></IonItemOptions></IonItemSliding>)}</IonList></IonContent></IonPage>;
}

function MessageBubble({ message, me, onAction }) {
  const mine = Number(message.senderId) === Number(me.id);
  const url = assetUrl(message.fileUrl);
  const isImage = message.mimeType?.startsWith('image/');
  const isVideo = message.mimeType?.startsWith('video/');
  const isAudio = message.mimeType?.startsWith('audio/') || message.type === 'voice';
  const status = mine ? (message.failedAt ? 'failed' : message.deliveredAt ? 'delivered' : message.status || 'sent') : '';
  return <div className={`message-line ${mine ? 'mine' : ''}`}><button className={`message-bubble ${mine ? 'mine' : ''}`} onContextMenu={(e) => { e.preventDefault(); onAction(message); }} onClick={() => onAction(message)}>{message.forwardedFromId && <small className="forwarded">Forwarded</small>}{message.replyTo && <span className="reply-chip"><Reply size={12} /> {message.replyTo.body}</span>}{message.deletedAt ? <em>Message deleted</em> : <>{message.body && <span className="message-text">{message.body}</span>}{isImage && url && <img className="message-media" src={url} alt={message.fileName || 'image'} />}{isVideo && url && <video className="message-media" src={url} controls preload="metadata" />}{isAudio && url && <audio src={url} controls preload="metadata" />}{url && !isImage && !isVideo && !isAudio && <span className="file-chip"><FileText size={16} />{message.fileName || 'File'}</span>}</>}<time>{formatTime(message.createdAt)}{status && ` · ${status}`}</time></button></div>;
}

function ChatRoom({ user, chat, messages, loading, text, setText, replyTo, onCancelReply, onSend, onBack, onRefresh, onFile, onInfo, onSearch, onOpenFiles, onSelectMessage, upload }) {
  const contentRef = useRef(null);
  const fileRef = useRef(null);
  const touchStart = useRef(null);
  useEffect(() => { requestAnimationFrame(() => contentRef.current?.scrollToBottom?.(250)); }, [messages.length, chat?.id]);
  if (!chat) return <IonPage className="empty-chat"><IonContent className="ion-padding"><div className="empty-state"><img src="/icon.svg" alt="" /><h2>Select a chat</h2><p>Start from the list or create a new conversation.</p></div></IonContent></IonPage>;
  function startSwipe(event) { const touch = event.touches?.[0]; if (!touch || touch.clientX > 32) return; touchStart.current = { x: touch.clientX, y: touch.clientY }; }
  function endSwipe(event) { if (!touchStart.current) return; const touch = event.changedTouches?.[0]; const dx = touch.clientX - touchStart.current.x; const dy = Math.abs(touch.clientY - touchStart.current.y); touchStart.current = null; if (dx > 84 && dy < 70) onBack(); }
  return <IonPage className="chat-room-page" onTouchStart={startSwipe} onTouchEnd={endSwipe}><IonHeader translucent><IonToolbar><IonButtons slot="start"><IonButton className="desktop-hidden" fill="clear" onClick={onBack}>Back</IonButton></IonButtons><button className="room-title" onClick={onInfo}><Avatar entity={chat} icon={chat.type === 'saved' ? '★' : chat.type === 'group' ? 'G' : undefined} /><span><b>{chat.title}</b><small>{chat.type}</small></span></button><IonButtons slot="end"><IonButton onClick={onSearch}><Search size={19} /></IonButton><IonButton onClick={onOpenFiles}><Image size={19} /></IonButton><IonButton onClick={onInfo}><Info size={19} /></IonButton></IonButtons></IonToolbar>{upload && <IonProgressBar value={upload.percent / 100} color="success" />}</IonHeader><IonContent ref={contentRef} className="messages-content"><IonRefresher slot="fixed" onIonRefresh={async (e) => { await onRefresh(); e.detail.complete(); }}><IonRefresherContent /></IonRefresher>{loading && <div className="center-note">Loading…</div>}<div className="message-stack">{messages.map((message) => <MessageBubble key={message.id || message.clientId} message={message} me={user} onAction={onSelectMessage} />)}</div></IonContent>{chat.type !== 'rss' && <IonFooter className="composer-footer">{replyTo && <div className="reply-composer"><Reply size={16} /><span><b>Replying</b><small>{snippet(replyTo)}</small></span><IonButton fill="clear" onClick={onCancelReply}><X size={16} /></IonButton></div>}<input ref={fileRef} type="file" hidden onChange={(e) => { const selected = e.target.files?.[0]; if (selected) onFile(selected); e.target.value = ''; }} /><div className="composer-bar"><IonButton fill="clear" onClick={() => fileRef.current?.click()}><Paperclip size={20} /></IonButton><IonTextarea autoGrow rows={1} placeholder="Message" value={text} onIonInput={(e) => setText(e.detail.value || '')} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }} /><IonButton onClick={onSend} disabled={!text.trim()}><Send size={18} /></IonButton></div></IonFooter>}</IonPage>;
}

function NewChatModal({ open, onClose, onCreated }) {
  const [type, setType] = useState('direct');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState('');
  const [rss, setRss] = useState('');
  const [toast, setToast] = useState('');
  useEffect(() => { if (!open || query.trim().length < 2) { setUsers([]); return undefined; } const timer = setTimeout(() => api(`/api/users/search?q=${encodeURIComponent(query.trim())}`).then((data) => setUsers(data.users || [])).catch((error) => setToast(error.message)), 250); return () => clearTimeout(timer); }, [query, open]);
  async function create(user) { try { const data = type === 'rss' ? await api('/api/v2/rss', { method: 'POST', body: JSON.stringify({ title, url: rss }) }) : type === 'group' ? await api('/api/chats/group', { method: 'POST', body: JSON.stringify({ title, memberIds: user ? [user.id] : [] }) }) : await api('/api/chats/direct', { method: 'POST', body: JSON.stringify({ userId: user.id }) }); onCreated(data.chat); } catch (error) { setToast(error.message); } }
  return <IonModal isOpen={open} onDidDismiss={onClose} breakpoints={[0, 0.75, 1]} initialBreakpoint={0.75}><IonHeader><IonToolbar><IonTitle>New chat</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar></IonHeader><IonContent className="ion-padding"><IonSegment value={type} onIonChange={(e) => setType(e.detail.value)}><IonSegmentButton value="direct">Direct</IonSegmentButton><IonSegmentButton value="group">Group</IonSegmentButton><IonSegmentButton value="rss">RSS</IonSegmentButton></IonSegment>{type !== 'direct' && <IonInput label="Title" labelPlacement="stacked" value={title} onIonInput={(e) => setTitle(e.detail.value || '')} />}{type === 'rss' ? <><IonInput label="RSS URL" labelPlacement="stacked" value={rss} onIonInput={(e) => setRss(e.detail.value || '')} /><IonButton expand="block" onClick={() => create()}>Add RSS</IonButton></> : <><IonSearchbar value={query} placeholder="Search users" onIonInput={(e) => setQuery(e.detail.value || '')} /><IonList>{users.map((candidate) => <IonItem button key={candidate.id} onClick={() => create(candidate)}><Avatar entity={candidate} /><IonLabel><h2>{candidate.displayName || candidate.username}</h2><p>@{candidate.username}</p></IonLabel></IonItem>)}</IonList></>}</IonContent><IonToast isOpen={Boolean(toast)} message={toast} duration={2500} onDidDismiss={() => setToast('')} /></IonModal>;
}

function SearchModal({ open, chat, onClose }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!open || !term.trim() || !chat) { setResults([]); return undefined; } const timer = setTimeout(() => api(`/api/v2/chats/${chat.id}/search?q=${encodeURIComponent(term.trim())}`).then((data) => setResults(data.messages || [])).catch((error) => setToast(error.message)), 250); return () => clearTimeout(timer); }, [term, open, chat?.id]);
  return <IonModal isOpen={open} onDidDismiss={onClose}><IonHeader><IonToolbar><IonTitle>Search</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar><IonToolbar><IonSearchbar autoFocus value={term} onIonInput={(e) => setTerm(e.detail.value || '')} /></IonToolbar></IonHeader><IonContent><IonList>{results.map((message) => <IonItem key={message.id}><IonLabel><h2>{message.body || message.fileName || 'Message'}</h2><p>{formatDate(message.createdAt)}</p></IonLabel></IonItem>)}</IonList></IonContent><IonToast isOpen={Boolean(toast)} message={toast} duration={2400} onDidDismiss={() => setToast('')} /></IonModal>;
}

function FilesModal({ open, chat, messages, onClose }) {
  const [tab, setTab] = useState('media');
  const media = messages.filter((m) => m.fileUrl && (m.mimeType?.startsWith('image/') || m.mimeType?.startsWith('video/')));
  const files = messages.filter((m) => m.fileUrl && !m.mimeType?.startsWith('image/') && !m.mimeType?.startsWith('video/') && !m.mimeType?.startsWith('audio/'));
  const voice = messages.filter((m) => m.mimeType?.startsWith('audio/') || m.type === 'voice');
  const links = messages.filter((m) => /https?:\/\/\S+/i.test(String(m.body || '')));
  const selected = tab === 'media' ? media : tab === 'files' ? files : tab === 'voice' ? voice : links;
  return <IonModal isOpen={open} onDidDismiss={onClose}><IonHeader><IonToolbar><IonTitle>{chat?.title || 'Files'}</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar><IonToolbar><IonSegment value={tab} onIonChange={(e) => setTab(e.detail.value)}><IonSegmentButton value="media">Media</IonSegmentButton><IonSegmentButton value="files">Files</IonSegmentButton><IonSegmentButton value="links">Links</IonSegmentButton><IonSegmentButton value="voice">Voice</IonSegmentButton></IonSegment></IonToolbar></IonHeader><IonContent className="ion-padding"><div className={tab === 'media' ? 'media-grid-v2' : 'file-list-v2'}>{selected.map((item, index) => { const url = assetUrl(item.fileUrl) || String(item.body || '').match(/https?:\/\/\S+/i)?.[0]; return tab === 'media' ? <a key={item.id || index} href={url} target="_blank" rel="noreferrer">{item.mimeType?.startsWith('video/') ? <video src={url} /> : <img src={url} />}</a> : <a key={item.id || index} href={url || '#'} target="_blank" rel="noreferrer"><FileText size={18} /><span>{item.fileName || item.body || 'Item'}</span></a>; })}{!selected.length && <p className="center-note">No {tab} yet.</p>}</div></IonContent></IonModal>;
}

function ChatInfoModal({ open, chat, info, onClose, onCreateInvite }) {
  return <IonModal isOpen={open} onDidDismiss={onClose} breakpoints={[0, 0.72, 1]} initialBreakpoint={0.72}><IonHeader><IonToolbar><IonTitle>Chat info</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar></IonHeader><IonContent className="ion-padding"><div className="info-hero"><Avatar entity={chat} icon={chat?.type === 'group' ? 'G' : chat?.type === 'saved' ? '★' : undefined} /><h2>{chat?.title}</h2><p>{chat?.type}</p></div>{info?.pinnedMessage && <IonItem lines="none"><Pin size={16} /><IonLabel><h2>Pinned message</h2><p>{info.pinnedMessage.body || info.pinnedMessage.fileName || 'Attachment'}</p></IonLabel></IonItem>}<IonList>{(info?.members || []).map((member) => <IonItem key={member.id}><Avatar entity={{ displayName: member.display_name, username: member.username, avatarUrl: member.avatar_url }} /><IonLabel><h2>{member.display_name || member.username}</h2><p>{member.role}</p></IonLabel></IonItem>)}</IonList>{chat?.type === 'group' && <IonButton expand="block" onClick={onCreateInvite}>Create invite link</IonButton>}</IonContent></IonModal>;
}

function SettingsModal({ open, user, onClose, onLogout, onUserUpdate }) {
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({ displayName: '', username: '', mobile: '', hidePresence: false });
  const [privacy, setPrivacy] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminChats, setAdminChats] = useState([]);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!open) return; setProfile({ displayName: user?.displayName || '', username: user?.username || '', mobile: user?.mobile || '', hidePresence: Boolean(user?.hidePresence) }); api('/api/v2/privacy').then(setPrivacy).catch(() => {}); api('/api/v2/sessions').then((data) => setSessions(data.sessions || [])).catch(() => {}); if (user?.role === 'admin') { api('/api/admin/users').then((data) => setAdminUsers(data.users || [])).catch((error) => setToast(error.message)); api('/api/admin/chats').then((data) => setAdminChats(data.chats || [])).catch(() => {}); } }, [open, user?.id]);
  async function saveProfile() { try { const data = await api('/api/me', { method: 'PATCH', body: JSON.stringify(profile) }); onUserUpdate(data.user); setToast('Profile saved'); } catch (error) { setToast(error.message); } }
  async function toggleBan(target) { try { await api(`/api/admin/users/${target.id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned: !target.isBanned }) }); setAdminUsers((list) => list.map((item) => item.id === target.id ? { ...item, isBanned: !item.isBanned } : item)); } catch (error) { setToast(error.message); } }
  return <IonModal isOpen={open} onDidDismiss={onClose}><IonHeader><IonToolbar><IonTitle>Settings</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar><IonToolbar><IonSegment value={tab} onIonChange={(e) => setTab(e.detail.value)}><IonSegmentButton value="profile">Profile</IonSegmentButton><IonSegmentButton value="privacy">Privacy</IonSegmentButton><IonSegmentButton value="sessions">Sessions</IonSegmentButton>{user?.role === 'admin' && <IonSegmentButton value="admin">Admin</IonSegmentButton>}</IonSegment></IonToolbar></IonHeader><IonContent className="ion-padding">{tab === 'profile' && <div className="settings-card form-card"><Avatar entity={user} /><IonInput label="Display name" labelPlacement="stacked" value={profile.displayName} onIonInput={(e) => setProfile({ ...profile, displayName: e.detail.value || '' })} /><IonInput label="Username" labelPlacement="stacked" value={profile.username} onIonInput={(e) => setProfile({ ...profile, username: e.detail.value || '' })} /><IonInput label="Mobile" labelPlacement="stacked" value={profile.mobile} onIonInput={(e) => setProfile({ ...profile, mobile: e.detail.value || '' })} /><IonItem lines="none"><IonToggle checked={profile.hidePresence} onIonChange={(e) => setProfile({ ...profile, hidePresence: e.detail.checked })}>Hide presence</IonToggle></IonItem><IonButton expand="block" onClick={saveProfile}>Save profile</IonButton><IonButton color="danger" expand="block" onClick={onLogout}><LogOut size={16} /> Sign out</IonButton></div>}{tab === 'privacy' && <div className="settings-card"><h2>Privacy</h2><p>Read receipts: {privacy?.privacy?.read_receipts ? 'on' : 'off'}</p><p>Last seen: {privacy?.privacy?.last_seen || 'everyone'}</p><p>Messages: {privacy?.privacy?.allow_messages || 'everyone'}</p></div>}{tab === 'sessions' && <IonList>{sessions.map((session) => <IonItem key={session.id}><IonLabel><h2>{session.id.slice(0, 10)}</h2><p>Last used: {formatDate(session.last_used_at)}</p></IonLabel></IonItem>)}</IonList>}{tab === 'admin' && <div className="admin-panel"><IonItem lines="none"><Shield size={18} /><IonLabel><h2>Admin panel</h2><p>{adminUsers.length} users · {adminChats.length} chats</p></IonLabel></IonItem><h3>Users</h3><IonList>{adminUsers.map((item) => <IonItem key={item.id}><Avatar entity={item} /><IonLabel><h2>{item.displayName || item.username}</h2><p>@{item.username} · {item.role} · {item.isBanned ? 'banned' : 'active'}</p></IonLabel><IonButton color={item.isBanned ? 'success' : 'danger'} fill="outline" disabled={item.id === user.id} onClick={() => toggleBan(item)}>{item.isBanned ? 'Unban' : 'Ban'}</IonButton></IonItem>)}</IonList><h3>Chats</h3><IonList>{adminChats.slice(0, 40).map((chat) => <IonItem key={chat.id}><IonLabel><h2>{chat.title || `${chat.type} #${chat.id}`}</h2><p>{chat.type} · owner #{chat.ownerId}</p></IonLabel></IonItem>)}</IonList></div>}</IonContent><IonToast isOpen={Boolean(toast)} message={toast} duration={2300} onDidDismiss={() => setToast('')} /></IonModal>;
}

function App() {
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messageAction, setMessageAction] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [upload, setUpload] = useState(null);
  const socketRef = useRef(null);
  const activeRef = useRef(null);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { if (getToken()) api('/api/me').then((data) => setUser(data.user)).catch(() => setToken(null)); }, []);
  useEffect(() => { if (user) { loadChats(); connectSocket(); } return () => socketRef.current?.close(); }, [user?.id]);
  useEffect(() => { if (active?.id) loadChat(active); }, [active?.id]);

  async function loadChats() { const data = await api('/api/v2/chats'); setChats(data.chats || []); return data.chats || []; }
  async function loadChat(chat) { try { setLoading(true); setReplyTo(null); setText(localStorage.getItem(`v2-draft-${chat.id}`) || ''); if (chat.type === 'rss') { const data = await api(`/api/chats/${chat.id}/messages`); setMessages(data.items || []); } else { const data = await api(`/api/v2/chats/${chat.id}/messages/page?limit=60`); setMessages(data.messages || []); } api(`/api/v2/chats/${chat.id}/info`).then(setChatInfo).catch(() => setChatInfo(null)); } catch (error) { setToast(error.message); } finally { setLoading(false); } }
  function connectSocket() { socketRef.current?.close(); const socket = io(socketOrigin, { auth: { token: getToken() }, reconnection: true }); socketRef.current = socket; socket.on('message:new', (message) => { if (Number(message.chatId) === Number(activeRef.current?.id)) setMessages((current) => [...current.filter((item) => item.id !== message.id), message]); loadChats().catch(() => {}); }); socket.on('message:updated', (message) => setMessages((current) => current.map((item) => item.id === message.id ? message : item))); socket.on('message:deleted', ({ id, deletedAt }) => setMessages((current) => current.map((item) => item.id === id ? { ...item, deletedAt, body: null, type: 'deleted' } : item))); socket.on('chat:new', () => loadChats().catch(() => {})); }
  async function send() { if (!active || !text.trim()) return; const body = text.trim(); const currentReply = replyTo; setText(''); setReplyTo(null); localStorage.removeItem(`v2-draft-${active.id}`); try { const data = await api(`/api/v2/chats/${active.id}/messages`, { method: 'POST', body: JSON.stringify({ body, replyToId: currentReply?.id || null, clientId: crypto.randomUUID() }) }); setMessages((current) => [...current, data.message]); await loadChats(); } catch (error) { setToast(error.message); setText(body); setReplyTo(currentReply); } }
  function updateDraft(value) { setText(value); if (active) { if (value.trim()) localStorage.setItem(`v2-draft-${active.id}`, value); else localStorage.removeItem(`v2-draft-${active.id}`); } }
  async function uploadFile(file) { if (!active) return; const formData = new FormData(); formData.append('file', file, file.name); formData.append('clientId', crypto.randomUUID()); formData.append('type', file.type.startsWith('audio/') ? 'voice' : 'file'); setUpload({ name: file.name, percent: 2 }); try { await new Promise((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open('POST', `${apiOrigin}/api/chats/${active.id}/files`); xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`); xhr.upload.onprogress = (event) => event.lengthComputable && setUpload({ name: file.name, percent: Math.round((event.loaded / event.total) * 100) }); xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed')); xhr.onerror = () => reject(new Error('Upload failed')); xhr.send(formData); }); await loadChat(active); } catch (error) { setToast(error.message); } finally { setTimeout(() => setUpload(null), 800); } }
  async function messageCommand(role) { const message = messageAction; setMessageAction(null); if (!message) return; try { if (role === 'reply') { setReplyTo(message); return; } if (role === 'copy') await navigator.clipboard?.writeText(message.body || message.fileName || ''); if (role === 'delete') await api(`/api/v2/messages/${message.id}`, { method: 'DELETE' }); if (role === 'save') { const saved = chats.find((chat) => chat.type === 'saved'); if (saved) await api(`/api/v2/messages/${message.id}/forward`, { method: 'POST', body: JSON.stringify({ chatId: saved.id }) }); } if (role === 'pin') await api(`/api/v2/messages/${message.id}/pin`, { method: 'POST' }); await loadChat(active); await loadChats(); } catch (error) { setToast(error.message); } }
  async function createInvite() { try { const data = await api(`/api/v2/chats/${active.id}/invites`, { method: 'POST' }); await navigator.clipboard?.writeText(`${location.origin}${data.invite.url}`); setToast('Invite link copied'); } catch (error) { setToast(error.message); } }

  if (!user) return <IonApp><AuthPage onDone={setUser} /></IonApp>;
  return <IonApp><div className={`desktop-shell ${active ? 'has-active-chat' : 'no-active-chat'}`}><ChatList chats={chats} activeId={active?.id} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onOpen={setActive} onNew={() => setNewChatOpen(true)} onRefresh={loadChats} onSettings={() => setSettingsOpen(true)} /><div id="main" className="main-pane"><ChatRoom user={user} chat={active} messages={messages} loading={loading} text={text} setText={updateDraft} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onSend={send} onBack={() => setActive(null)} onRefresh={() => active && loadChat(active)} onFile={uploadFile} onInfo={() => setInfoOpen(true)} onSearch={() => setSearchOpen(true)} onOpenFiles={() => setFilesOpen(true)} onSelectMessage={setMessageAction} upload={upload} /></div></div><IonFab vertical="bottom" horizontal="end" slot="fixed"><IonFabButton onClick={() => setNewChatOpen(true)}><Plus size={22} /></IonFabButton></IonFab><NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} onCreated={(chat) => { setNewChatOpen(false); loadChats().then(() => setActive(chat)); }} /><SearchModal open={searchOpen} chat={active} onClose={() => setSearchOpen(false)} /><FilesModal open={filesOpen} chat={active} messages={messages} onClose={() => setFilesOpen(false)} /><ChatInfoModal open={infoOpen} chat={active} info={chatInfo} onClose={() => setInfoOpen(false)} onCreateInvite={createInvite} /><SettingsModal open={settingsOpen} user={user} onClose={() => setSettingsOpen(false)} onLogout={() => { setToken(null); location.reload(); }} onUserUpdate={setUser} /><IonActionSheet isOpen={Boolean(messageAction)} header="Message" onDidDismiss={() => setMessageAction(null)} buttons={[{ text: 'Reply', handler: () => messageCommand('reply') }, { text: 'Copy', handler: () => messageCommand('copy') }, { text: 'Save to Saved Messages', handler: () => messageCommand('save') }, { text: 'Pin', handler: () => messageCommand('pin') }, { text: 'Delete', role: 'destructive', handler: () => messageCommand('delete') }, { text: 'Cancel', role: 'cancel' }]} /><IonToast isOpen={Boolean(toast)} message={toast} duration={2600} onDidDismiss={() => setToast('')} /></IonApp>;
}

createRoot(document.getElementById('root')).render(<App />);
