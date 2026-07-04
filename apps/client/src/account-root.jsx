import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Ban,
  Camera,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  UnlockKeyhole,
  UserRoundCog,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { api, getToken } from './api';
import { apiOrigin } from './runtime';
import './account.css';

function assetUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? `${apiOrigin}${value}` : value;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function userLabel(user) {
  return user?.displayName || user?.username || `User #${user?.id ?? '—'}`;
}

function initials(user) {
  return userLabel(user).trim().slice(0, 2).toUpperCase();
}

function UserAvatar({ user, large = false }) {
  const source = assetUrl(user?.avatarUrl);
  return (
    <span className={`account-avatar ${large ? 'large' : ''}`}>
      {source ? <img src={source} alt={userLabel(user)} /> : initials(user)}
    </span>
  );
}

function PanelShell({ title, subtitle, icon, onClose, wide = false, children }) {
  return (
    <div className="account-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`account-panel ${wide ? 'account-panel-wide' : ''}`} role="dialog" aria-modal="true">
        <header className="account-panel-head">
          <div className="account-panel-title"><span className="account-panel-icon">{icon}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div>
          <button className="account-icon-button" title="Close" onClick={onClose}><X /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function Notice({ type = 'error', children }) {
  return children ? <div className={`account-notice ${type}`}>{children}</div> : null;
}

function ProfilePanel({ user, onUserChanged, onClose }) {
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({
    displayName: user.displayName || '',
    username: user.username || '',
    mobile: user.mobile || '',
    hidePresence: Boolean(user.hidePresence),
  });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const avatarInput = useRef(null);

  function resetMessages() {
    setError('');
    setSuccess('');
  }

  async function uploadAvatar(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Avatar size must be 5 MB or less.');
      return;
    }

    try {
      setAvatarBusy(true);
      resetMessages();
      const formData = new FormData();
      formData.append('avatar', file, file.name);
      const data = await api('/api/v2/me/avatar', { method: 'POST', body: formData });
      onUserChanged(data.user);
      setSuccess('Profile image updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAvatarBusy(false);
      if (avatarInput.current) avatarInput.current.value = '';
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    resetMessages();
    if (!form.username.trim() || !form.mobile.trim()) {
      setError('Username and mobile number are required.');
      return;
    }
    try {
      setBusy(true);
      const data = await api('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          username: form.username.trim(),
          mobile: form.mobile.trim(),
          hidePresence: form.hidePresence,
        }),
      });
      onUserChanged(data.user);
      setSuccess('Profile updated successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    resetMessages();
    if (!password.currentPassword) return setError('Enter your current password.');
    if (password.newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (password.newPassword !== password.confirmPassword) return setError('New password confirmation does not match.');

    try {
      setBusy(true);
      await api('/api/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: password.currentPassword, newPassword: password.newPassword }),
      });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess('Password changed successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelShell title="Your profile" subtitle="Account details, privacy, image and password" icon={<CircleUserRound />} onClose={onClose}>
      <div className="account-profile-summary">
        <div className="account-avatar-editor">
          <UserAvatar user={user} large />
          <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(event) => uploadAvatar(event.target.files?.[0])} />
          <button title="Upload profile image" disabled={avatarBusy} onClick={() => avatarInput.current?.click()}>
            {avatarBusy ? <Loader2 className="spin" /> : <Camera />}
          </button>
        </div>
        <div><strong>{userLabel(user)}</strong><span>@{user.username} · {user.role}</span><small>JPG, PNG, WebP or GIF · maximum 5 MB</small></div>
      </div>

      <div className="account-tabs">
        <button className={tab === 'profile' ? 'active' : ''} onClick={() => { setTab('profile'); resetMessages(); }}><UserRoundCog />Profile</button>
        <button className={tab === 'password' ? 'active' : ''} onClick={() => { setTab('password'); resetMessages(); }}><KeyRound />Password</button>
      </div>

      <div className="account-panel-body">
        <Notice>{error}</Notice><Notice type="success">{success}</Notice>
        {tab === 'profile' ? (
          <form className="account-form" onSubmit={saveProfile}>
            <label>Display name<input value={form.displayName} placeholder="Your visible name" onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
            <div className="account-form-grid">
              <label>Username<input value={form.username} autoCapitalize="none" onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
              <label>Mobile number<input value={form.mobile} inputMode="tel" onChange={(event) => setForm({ ...form, mobile: event.target.value })} /></label>
            </div>
            <label className="account-toggle-row">
              <span>{form.hidePresence ? <EyeOff /> : <Eye />}<span><strong>Hide online status and last seen</strong><small>Other users will not receive your presence status.</small></span></span>
              <input type="checkbox" checked={form.hidePresence} onChange={(event) => setForm({ ...form, hidePresence: event.target.checked })} />
            </label>
            <button className="account-primary" disabled={busy}>{busy ? <Loader2 className="spin" /> : <CheckCircle2 />}Save changes</button>
          </form>
        ) : (
          <form className="account-form" onSubmit={changePassword}>
            <label>Current password<input type={showPasswords ? 'text' : 'password'} value={password.currentPassword} autoComplete="current-password" onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} /></label>
            <label>New password<input type={showPasswords ? 'text' : 'password'} value={password.newPassword} autoComplete="new-password" onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} /></label>
            <label>Confirm new password<input type={showPasswords ? 'text' : 'password'} value={password.confirmPassword} autoComplete="new-password" onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} /></label>
            <label className="account-inline-check"><input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} />Show passwords</label>
            <button className="account-primary" disabled={busy}>{busy ? <Loader2 className="spin" /> : <LockKeyhole />}Change password</button>
          </form>
        )}
      </div>
    </PanelShell>
  );
}

function StatCard({ label, value, icon }) {
  return <article className="admin-stat-card"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>;
}

function AdminPanel({ onClose }) {
  const [tab, setTab] = useState('overview');
  const [usersList, setUsersList] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');

  async function loadAdminData() {
    try {
      setBusy(true);
      setError('');
      const [usersData, chatsData, onlineData] = await Promise.all([
        api('/api/admin/users'),
        api('/api/admin/chats'),
        api('/api/v2/admin/online-users'),
      ]);
      setUsersList(usersData.users || []);
      setChats(chatsData.chats || []);
      setOnlineUsers(onlineData.users || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadAdminData();
    const timer = setInterval(() => {
      api('/api/v2/admin/online-users').then((data) => setOnlineUsers(data.users || [])).catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return usersList;
    return usersList.filter((item) => [item.displayName, item.username, item.mobile, item.role].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)));
  }, [usersList, query]);

  const stats = useMemo(() => ({
    users: usersList.length,
    online: onlineUsers.length,
    admins: usersList.filter((item) => item.role === 'admin').length,
    banned: usersList.filter((item) => item.isBanned).length,
    chats: chats.length,
    direct: chats.filter((item) => item.type === 'direct').length,
    groups: chats.filter((item) => item.type === 'group').length,
    rss: chats.filter((item) => item.type === 'rss').length,
  }), [usersList, onlineUsers, chats]);

  async function toggleBan(target) {
    try {
      setActionId(target.id);
      await api(`/api/admin/users/${target.id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned: !target.isBanned }) });
      setUsersList((current) => current.map((item) => item.id === target.id ? { ...item, isBanned: !target.isBanned } : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionId(null);
    }
  }

  async function inspectChat(chat) {
    try {
      setSelectedChat(chat);
      setMessages([]);
      const data = await api(`/api/admin/chats/${chat.id}/messages`);
      setMessages(data.messages || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <PanelShell title="Administration" subtitle="Users, online sessions and conversations" icon={<ShieldCheck />} onClose={onClose} wide>
      <div className="admin-layout">
        <aside className="admin-nav">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><Activity />Overview</button>
          <button className={tab === 'online' ? 'active' : ''} onClick={() => setTab('online')}><Wifi />Online users</button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><Users />Users</button>
          <button className={tab === 'chats' ? 'active' : ''} onClick={() => setTab('chats')}><MessageSquareText />Chats</button>
          <button onClick={loadAdminData}><RefreshCw />Refresh data</button>
        </aside>

        <main className="admin-content">
          <Notice>{error}</Notice>
          {busy ? <div className="account-loading"><Loader2 className="spin" />Loading administration data…</div> : (
            <>
              {tab === 'overview' && (
                <div className="admin-section">
                  <div className="admin-section-head"><div><h3>System overview</h3><p>Live summary from the application database.</p></div></div>
                  <div className="admin-stats">
                    <StatCard label="Total users" value={stats.users} icon={<Users />} />
                    <StatCard label="Online now" value={stats.online} icon={<Wifi />} />
                    <StatCard label="Banned users" value={stats.banned} icon={<Ban />} />
                    <StatCard label="All chats" value={stats.chats} icon={<MessageSquareText />} />
                  </div>
                  <div className="admin-breakdown"><div><span>Administrators</span><strong>{stats.admins}</strong></div><div><span>Direct chats</span><strong>{stats.direct}</strong></div><div><span>Groups</span><strong>{stats.groups}</strong></div><div><span>RSS channels</span><strong>{stats.rss}</strong></div></div>
                </div>
              )}

              {tab === 'online' && (
                <div className="admin-section">
                  <div className="admin-section-head"><div><h3>Online users</h3><p>Updated automatically every 15 seconds.</p></div><button className="admin-back" onClick={loadAdminData}><RefreshCw />Refresh</button></div>
                  <div className="online-user-grid">
                    {onlineUsers.length === 0 ? <div className="account-empty">No users are online.</div> : onlineUsers.map((item) => (
                      <article key={item.id}><UserAvatar user={item} /><div><strong>{userLabel(item)}</strong><small>@{item.username} · {item.connections || 1} connection{item.connections === 1 ? '' : 's'}</small></div><span className="online-indicator">online</span></article>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'users' && (
                <div className="admin-section">
                  <div className="admin-section-head"><div><h3>User management</h3><p>Search accounts and control access.</p></div><label className="admin-search"><Search /><input value={query} placeholder="Search name, username or mobile" onChange={(event) => setQuery(event.target.value)} /></label></div>
                  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Mobile</th><th>Role</th><th>Last seen</th><th>Status</th><th /></tr></thead><tbody>
                    {filteredUsers.map((item) => <tr key={item.id}><td><div className="admin-user-cell"><UserAvatar user={item} /><span><strong>{userLabel(item)}</strong><small>@{item.username} · #{item.id}</small></span></div></td><td>{item.mobile || '—'}</td><td><span className={`admin-role ${item.role}`}>{item.role}</span></td><td>{item.hidePresence ? 'Hidden' : formatDate(item.lastSeenAt)}</td><td><span className={`admin-status ${item.isBanned ? 'banned' : 'active'}`}>{item.isBanned ? 'Banned' : 'Active'}</span></td><td><button className={`admin-action ${item.isBanned ? 'positive' : 'danger'}`} disabled={actionId === item.id} onClick={() => toggleBan(item)}>{actionId === item.id ? <Loader2 className="spin" /> : item.isBanned ? <UnlockKeyhole /> : <Ban />}{item.isBanned ? 'Unban' : 'Ban'}</button></td></tr>)}
                  </tbody></table></div>
                </div>
              )}

              {tab === 'chats' && (
                <div className="admin-section admin-chat-section">
                  {selectedChat ? (
                    <><div className="admin-section-head"><button className="admin-back" onClick={() => { setSelectedChat(null); setMessages([]); }}><ChevronLeft />Back</button><div><h3>{selectedChat.title || `${selectedChat.type} chat #${selectedChat.id}`}</h3><p>{selectedChat.type} · Owner #{selectedChat.ownerId ?? '—'} · {formatDate(selectedChat.updatedAt)}</p></div></div><div className="admin-message-list">{messages.length === 0 ? <div className="account-empty">No messages found in this chat.</div> : messages.map((message) => <article key={message.id || message.clientId}><header><strong>User #{message.senderId}</strong><time>{formatDate(message.createdAt)}</time></header><p>{message.body || message.fileName || `Message #${message.id}`}</p><small>{message.type || 'text'}{message.mimeType ? ` · ${message.mimeType}` : ''}{message.fileSize ? ` · ${Math.round(message.fileSize / 1024)} KB` : ''}</small></article>)}</div></>
                  ) : (
                    <><div className="admin-section-head"><div><h3>Conversation management</h3><p>Inspect all direct chats, groups and RSS channels.</p></div></div><div className="admin-chat-grid">{chats.map((chat) => <button key={chat.id} onClick={() => inspectChat(chat)}><span className={`admin-chat-icon ${chat.type}`}><MessageSquareText /></span><span><strong>{chat.title || `${chat.type} chat #${chat.id}`}</strong><small>{chat.type} · Owner #{chat.ownerId ?? '—'}</small></span><time>{formatDate(chat.updatedAt)}</time></button>)}</div></>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </PanelShell>
  );
}

function AccountRoot() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null);

  async function loadUser() {
    if (!getToken()) {
      setUser(null);
      setMode(null);
      return;
    }
    try {
      const data = await api('/api/me');
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    loadUser();
    const handleAuth = () => loadUser();
    window.addEventListener('verdant-auth-change', handleAuth);
    return () => window.removeEventListener('verdant-auth-change', handleAuth);
  }, []);

  if (!user) return null;

  return (
    <>
      <div className="account-launcher">
        {user.role === 'admin' && <button title="Administration" onClick={() => setMode('admin')}><ShieldCheck /></button>}
        <button className="account-user-launch" title="Profile" onClick={() => setMode('profile')}><UserAvatar user={user} /><span><strong>{userLabel(user)}</strong><small>@{user.username}</small></span></button>
      </div>
      {mode === 'profile' && <ProfilePanel user={user} onClose={() => setMode(null)} onUserChanged={setUser} />}
      {mode === 'admin' && user.role === 'admin' && <AdminPanel onClose={() => setMode(null)} />}
    </>
  );
}

const root = document.getElementById('account-root');
if (root) createRoot(root).render(<AccountRoot />);
