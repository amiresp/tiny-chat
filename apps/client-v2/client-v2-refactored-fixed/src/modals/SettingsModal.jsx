import React, { useEffect, useMemo, useState } from 'react';
import {
  IonAlert, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonLabel,
  IonList, IonModal, IonSearchbar, IonSegment, IonSegmentButton, IonSelect,
  IonSelectOption, IonTitle, IonToast, IonToggle, IonToolbar,
} from '../ui/primitives';
import { AtSign, Bell, ChevronLeft, Edit3, Info, KeyRound, Languages, Lock, LogOut, Monitor, Moon, Palette, Phone, Shield, Smartphone, Sun, Trash2, Type, UserRound, X } from 'lucide-react';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { formatDate, isAdmin } from '../lib/chat';

export function SettingsModal({ open, user, onClose, onLogout, onUserUpdate, themeMode, onThemeModeChange }) {
  const [tab, setTab] = useState('home');
  const [profile, setProfile] = useState({ displayName: '', username: '', mobile: '', hidePresence: false });
  const [privacy, setPrivacy] = useState({ readReceipts: true, lastSeen: 'everyone', allowMessages: 'everyone' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [sessions, setSessions] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminChats, setAdminChats] = useState([]);
  const [adminQuery, setAdminQuery] = useState('');
  const [deleteChat, setDeleteChat] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setProfile({ displayName: user?.displayName || '', username: user?.username || '', mobile: user?.mobile || '', hidePresence: Boolean(user?.hidePresence) });
    Promise.allSettled([
      api('/api/v2/privacy').then((data) => alive && setPrivacy({ readReceipts: Boolean(data.privacy?.read_receipts), lastSeen: data.privacy?.last_seen || 'everyone', allowMessages: data.privacy?.allow_messages || 'everyone' })),
      api('/api/v2/sessions').then((data) => alive && setSessions(data.sessions || [])),
      ...(isAdmin(user) ? [
        api('/api/admin/users').then((data) => alive && setAdminUsers(data.users || [])),
        api('/api/admin/chats').then((data) => alive && setAdminChats(data.chats || [])),
      ] : []),
    ]).catch(() => {});
    return () => { alive = false; };
  }, [open, user?.id]);

  const filteredAdminChats = useMemo(() => {
    const term = adminQuery.trim().toLowerCase();
    return term ? adminChats.filter((chat) => `${chat.title || ''} ${chat.type || ''} ${chat.id}`.toLowerCase().includes(term)) : adminChats;
  }, [adminChats, adminQuery]);

  async function saveProfile() {
    try { const data = await api('/api/me', { method: 'PATCH', body: JSON.stringify(profile) }); onUserUpdate(data.user); setToast('Profile saved'); } catch (error) { setToast(error.message); }
  }
  async function savePrivacy() {
    try { await api('/api/v2/privacy', { method: 'PATCH', body: JSON.stringify(privacy) }); setToast('Privacy saved'); } catch (error) { setToast(error.message); }
  }
  async function changePassword() {
    try { await api('/api/me/password', { method: 'PATCH', body: JSON.stringify(password) }); setPassword({ currentPassword: '', newPassword: '' }); setToast('Password changed'); } catch (error) { setToast(error.message); }
  }
  async function logoutSession(session) {
    try { await api(`/api/v2/sessions/${session.id}`, { method: 'DELETE' }); setSessions((list) => list.filter((item) => item.id !== session.id)); } catch (error) { setToast(error.message); }
  }
  async function toggleBan(target) {
    try { await api(`/api/admin/users/${target.id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned: !target.isBanned }) }); setAdminUsers((list) => list.map((item) => item.id === target.id ? { ...item, isBanned: !item.isBanned } : item)); } catch (error) { setToast(error.message); }
  }
  async function permanentlyDeleteChat() {
    if (!deleteChat) return;
    const target = deleteChat;
    setDeleteChat(null);
    try {
      await api(`/api/v2/admin/chats/${target.id}`, { method: 'DELETE' });
      setAdminChats((list) => list.filter((chat) => Number(chat.id) !== Number(target.id)));
      setToast('Chat deleted permanently');
    } catch (error) { setToast(error.message); }
  }

  const sections = [
    ['profile', UserRound, 'Profile', 'Name, username and presence'],
    ['appearance', Palette, 'Appearance', 'Theme and interface'],
    ['privacy', Shield, 'Privacy', 'Receipts and visibility'],
    ['security', KeyRound, 'Security', 'Change your password'],
    ['sessions', Smartphone, 'Sessions', 'Signed-in devices'],
    ...(isAdmin(user) ? [['admin', Shield, 'Admin', 'Users and chats']] : []),
  ];
  const activeSection = sections.find(([key]) => key === tab);

  return <IonModal isOpen={open} onDidDismiss={onClose} cssClass="settings-modal">
    <IonHeader>
      <IonToolbar className="settings-topbar">
        {tab !== 'home' && <IonButtons><IonButton className="settings-back" onClick={() => setTab('home')} aria-label="Back to settings">‹</IonButton></IonButtons>}
        <IonTitle>{tab === 'home' ? 'Settings' : activeSection?.[2] || 'Settings'}</IonTitle>
        <IonButtons slot="end"><IonButton onClick={onClose} aria-label="Close settings"><X size={19} /></IonButton></IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent className="settings-content">
      {tab === 'home' && <div className="settings-reference settings-body">
        <button type="button" className="settings-profile" onClick={() => setTab('profile')}>
          <Avatar entity={user} />
          <div className="sp-body"><h3>{user?.displayName || user?.username || 'کاربر Tiny Chat'}</h3><p>{user?.mobile || `@${user?.username || 'user'}`}</p></div>
        </button>
        <div className="settings-section">
          <div className="settings-section-title">حساب کاربری</div>
          <button type="button" className="settings-item" onClick={() => setTab('profile')}><Edit3 className="si-icon"/><div className="si-body"><div className="si-title">ویرایش پروفایل</div><div className="si-sub">نام، نام کاربری و وضعیت حضور</div></div><ChevronLeft className="si-arrow"/></button>
          <div className="settings-item"><Phone className="si-icon"/><div className="si-body"><div className="si-title">شماره تلفن</div></div><span className="si-value">{user?.mobile || '—'}</span></div>
          <div className="settings-item"><AtSign className="si-icon"/><div className="si-body"><div className="si-title">نام کاربری</div></div><span className="si-value">@{user?.username || '—'}</span></div>
        </div>
        <div className="settings-section">
          <div className="settings-section-title">تنظیمات</div>
          <button type="button" className="settings-item" onClick={() => setTab('privacy')}><Lock className="si-icon"/><div className="si-body"><div className="si-title">حریم خصوصی و امنیت</div><div className="si-sub">آخرین بازدید و رسید خواندن</div></div><ChevronLeft className="si-arrow"/></button>
          <button type="button" className="settings-item" onClick={() => setTab('security')}><KeyRound className="si-icon"/><div className="si-body"><div className="si-title">رمز عبور</div></div><ChevronLeft className="si-arrow"/></button>
          <button type="button" className="settings-item" onClick={() => setTab('sessions')}><Smartphone className="si-icon"/><div className="si-body"><div className="si-title">نشست‌های فعال</div></div><ChevronLeft className="si-arrow"/></button>
          <button type="button" className="settings-item" onClick={() => onThemeModeChange(themeMode === 'dark' ? 'light' : 'dark')}><Moon className="si-icon"/><div className="si-body"><div className="si-title">حالت تاریک</div></div><div className={`toggle ${themeMode === 'dark' ? 'on' : ''}`}/></button>
        </div>
        <div className="settings-section">
          <div className="settings-section-title">زبان و ظاهر</div>
          <div className="settings-item"><Languages className="si-icon"/><div className="si-body"><div className="si-title">زبان</div></div><span className="si-value">فارسی</span></div>
          <button type="button" className="settings-item" onClick={() => setTab('appearance')}><Palette className="si-icon"/><div className="si-body"><div className="si-title">تم رنگی</div></div><span className="si-value">{themeMode === 'dark' ? 'تیره' : themeMode === 'light' ? 'روشن' : 'سیستم'}</span></button>
          <div className="settings-item"><Type className="si-icon"/><div className="si-body"><div className="si-title">اندازه متن</div></div><span className="si-value">متوسط</span></div>
        </div>
        {isAdmin(user) && <div className="settings-section"><div className="settings-section-title">مدیریت</div><button type="button" className="settings-item" onClick={() => setTab('admin')}><Shield className="si-icon"/><div className="si-body"><div className="si-title">پنل مدیریت</div><div className="si-sub">{adminUsers.length} کاربر · {adminChats.length} چت</div></div><ChevronLeft className="si-arrow"/></button></div>}
        <div className="settings-section">
          <div className="settings-section-title">درباره</div>
          <div className="settings-item"><Info className="si-icon"/><div className="si-body"><div className="si-title">درباره Tiny Chat</div><div className="si-sub">Tiny Chat</div></div></div>
          <button type="button" className="settings-item" onClick={onLogout}><LogOut className="si-icon" style={{color:'var(--danger)'}}/><div className="si-body"><div className="si-title" style={{color:'var(--danger)'}}>خروج از حساب</div></div></button>
        </div>
      </div>}

      {tab === 'profile' && <div className="settings-card form-card settings-detail-card"><div className="settings-detail-avatar"><Avatar entity={{ ...user, displayName: profile.displayName, username: profile.username }} /></div><IonInput label="Display name" value={profile.displayName} onIonInput={(event) => setProfile((current) => ({ ...current, displayName: event.detail.value || '' }))} /><IonInput label="Username" value={profile.username} onIonInput={(event) => setProfile((current) => ({ ...current, username: event.detail.value || '' }))} /><IonInput label="Mobile" value={profile.mobile} onIonInput={(event) => setProfile((current) => ({ ...current, mobile: event.detail.value || '' }))} /><IonToggle checked={profile.hidePresence} onIonChange={(event) => setProfile((current) => ({ ...current, hidePresence: event.detail.checked }))}>Hide presence</IonToggle><IonButton expand="block" onClick={saveProfile}>Save changes</IonButton></div>}

      {tab === 'appearance' && <div className="settings-card form-card settings-detail-card"><h2><Palette size={19} /> Appearance</h2><div className="settings-theme-options">{[['system', Monitor, 'System'], ['light', Sun, 'Light'], ['dark', Moon, 'Dark']].map(([value, Icon, label]) => <button type="button" key={value} className={themeMode === value ? 'active' : ''} onClick={() => onThemeModeChange(value)}><Icon size={20}/><span>{label}</span></button>)}</div><div className="theme-preview"><div><b>Chat preview</b><p>Your Tiny Chat theme follows this setting everywhere.</p></div><span>Aa</span></div></div>}

      {tab === 'privacy' && <div className="settings-card form-card settings-detail-card"><h2><Shield size={19} /> Privacy</h2><IonToggle checked={privacy.readReceipts} onIonChange={(event) => setPrivacy((current) => ({ ...current, readReceipts: event.detail.checked }))}>Read receipts</IonToggle><IonSelect label="Last seen" value={privacy.lastSeen} onIonChange={(event) => setPrivacy((current) => ({ ...current, lastSeen: event.detail.value }))}><IonSelectOption value="everyone">Everyone</IonSelectOption><IonSelectOption value="nobody">Nobody</IonSelectOption></IonSelect><IonSelect label="Who can message me" value={privacy.allowMessages} onIonChange={(event) => setPrivacy((current) => ({ ...current, allowMessages: event.detail.value }))}><IonSelectOption value="everyone">Everyone</IonSelectOption><IonSelectOption value="contacts">Contacts</IonSelectOption></IonSelect><IonButton expand="block" onClick={savePrivacy}>Save privacy</IonButton></div>}

      {tab === 'security' && <div className="settings-card form-card settings-detail-card"><h2><Lock size={19} /> Password</h2><IonInput label="Current password" type="password" value={password.currentPassword} onIonInput={(event) => setPassword((current) => ({ ...current, currentPassword: event.detail.value || '' }))} /><IonInput label="New password" type="password" value={password.newPassword} onIonInput={(event) => setPassword((current) => ({ ...current, newPassword: event.detail.value || '' }))} /><IonButton expand="block" disabled={password.newPassword.length < 8} onClick={changePassword}>Change password</IonButton></div>}

      {tab === 'sessions' && <div className="settings-card settings-detail-card"><h2><Smartphone size={19}/> Active sessions</h2><IonList>{sessions.map((session) => <IonItem key={session.id}><IonLabel><h2>{session.id.slice(0, 10)}</h2><p>Last used: {formatDate(session.last_used_at)}</p></IonLabel><IonButton color="danger" fill="outline" onClick={() => logoutSession(session)}>Logout</IonButton></IonItem>)}</IonList>{!sessions.length && <div className="center-note">No other sessions</div>}</div>}

      {tab === 'admin' && <div className="admin-panel settings-detail-card"><IonItem><Shield size={18} /><IonLabel><h2>Admin panel</h2><p>{adminUsers.length} users · {adminChats.length} chats</p></IonLabel></IonItem><h3>Users</h3><IonList>{adminUsers.map((item) => <IonItem key={item.id}><Avatar entity={item} /><IonLabel><h2>{item.displayName || item.username}</h2><p>@{item.username} · {item.role} · {item.isBanned ? 'banned' : 'active'}</p></IonLabel><IonButton color={item.isBanned ? 'success' : 'danger'} fill="outline" disabled={item.id === user.id} onClick={() => toggleBan(item)}>{item.isBanned ? 'Unban' : 'Ban'}</IonButton></IonItem>)}</IonList><h3>Chats</h3><IonSearchbar value={adminQuery} placeholder="Search chats" onIonInput={(event) => setAdminQuery(event.detail.value || '')} /><IonList>{filteredAdminChats.slice(0, 120).map((chat) => <IonItem key={chat.id}><IonLabel><h2>{chat.title || `${chat.type} #${chat.id}`}</h2><p>{chat.type} · owner #{chat.ownerId || chat.owner_id || '—'}</p></IonLabel><IonButton color="danger" fill="clear" aria-label="Delete chat permanently" onClick={() => setDeleteChat(chat)}><Trash2 size={17} /></IonButton></IonItem>)}</IonList></div>}
    </IonContent>
    <IonToast isOpen={Boolean(toast)} message={toast} duration={2300} onDidDismiss={() => setToast('')} />
    <IonAlert isOpen={Boolean(deleteChat)} header="Delete permanently?" message="The chat, memberships and messages will be permanently removed." buttons={[{ text: 'Cancel', role: 'cancel' }, { text: 'Delete', role: 'destructive', handler: permanentlyDeleteChat }]} onDidDismiss={() => setDeleteChat(null)} />
  </IonModal>;
}
