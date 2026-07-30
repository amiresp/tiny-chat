import React, { useEffect, useMemo, useState } from 'react';
import {
  IonAlert, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonLabel,
  IonList, IonModal, IonSearchbar, IonSegment, IonSegmentButton, IonSelect,
  IonSelectOption, IonTitle, IonToast, IonToggle, IonToolbar,
} from '@ionic/react';
import { Lock, LogOut, MessageSquareText, Moon, Shield, Sun, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { formatDate, isAdmin } from '../lib/chat';
import { AdminChatViewerModal } from './AdminChatViewerModal';

function participantName(participant) {
  return participant?.displayName || participant?.username || (participant?.id ? `User #${participant.id}` : 'Unknown user');
}

function adminChatTitle(chat) {
  if (chat.displayTitle) return chat.displayTitle;
  const participants = chat.participants || [];
  const names = participants.map(participantName);
  if (chat.type === 'direct') return names.join(' ↔ ') || `Direct chat #${chat.id}`;
  if (chat.type === 'saved') return `Saved Messages · ${names[0] || `User #${chat.ownerId || '—'}`}`;
  return chat.title || names.join(', ') || `${chat.type} #${chat.id}`;
}

function adminChatSearchValue(chat) {
  const participants = (chat.participants || []).flatMap((participant) => [
    participant.displayName,
    participant.username,
    participant.mobile,
    participant.id,
  ]);
  return [chat.id, chat.type, chat.title, chat.displayTitle, chat.lastMessagePreview, ...participants]
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase();
}

export function SettingsModal({ open, user, onClose, onLogout, onUserUpdate, themeMode, onThemeModeChange }) {
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({ displayName: '', username: '', mobile: '', hidePresence: false });
  const [privacy, setPrivacy] = useState({ readReceipts: true, lastSeen: 'everyone', allowMessages: 'everyone' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [sessions, setSessions] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminChats, setAdminChats] = useState([]);
  const [adminQuery, setAdminQuery] = useState('');
  const [selectedAdminChat, setSelectedAdminChat] = useState(null);
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
        api('/api/v2/admin/audit/chats').then((data) => alive && setAdminChats(data.chats || [])),
      ] : []),
    ]).catch(() => {});
    return () => { alive = false; };
  }, [open, user?.id]);

  const filteredAdminChats = useMemo(() => {
    const term = adminQuery.trim().toLowerCase();
    return term ? adminChats.filter((chat) => adminChatSearchValue(chat).includes(term)) : adminChats;
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
      if (Number(selectedAdminChat?.id) === Number(target.id)) setSelectedAdminChat(null);
      setToast('Chat deleted permanently');
    } catch (error) { setToast(error.message); }
  }

  return <>
    <IonModal isOpen={open} onDidDismiss={onClose} cssClass="settings-modal">
      <IonHeader><IonToolbar><IonTitle>Settings</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar><IonToolbar><IonSegment scrollable value={tab} onIonChange={(event) => setTab(event.detail.value)}><IonSegmentButton value="profile">Profile</IonSegmentButton><IonSegmentButton value="appearance">Appearance</IonSegmentButton><IonSegmentButton value="privacy">Privacy</IonSegmentButton><IonSegmentButton value="security">Security</IonSegmentButton><IonSegmentButton value="sessions">Sessions</IonSegmentButton>{isAdmin(user) && <IonSegmentButton value="admin">Admin</IonSegmentButton>}</IonSegment></IonToolbar></IonHeader>
      <IonContent className="ion-padding">
        {tab === 'profile' && <div className="settings-card form-card"><Avatar entity={user} /><IonInput label="Display name" labelPlacement="stacked" value={profile.displayName} onIonInput={(event) => setProfile((current) => ({ ...current, displayName: event.detail.value || '' }))} /><IonInput label="Username" labelPlacement="stacked" value={profile.username} onIonInput={(event) => setProfile((current) => ({ ...current, username: event.detail.value || '' }))} /><IonInput label="Mobile" labelPlacement="stacked" value={profile.mobile} onIonInput={(event) => setProfile((current) => ({ ...current, mobile: event.detail.value || '' }))} /><IonItem lines="none"><IonToggle checked={profile.hidePresence} onIonChange={(event) => setProfile((current) => ({ ...current, hidePresence: event.detail.checked }))}>Hide presence</IonToggle></IonItem><IonButton expand="block" onClick={saveProfile}>Save profile</IonButton><IonButton color="danger" expand="block" onClick={onLogout}><LogOut size={16} /> Sign out</IonButton></div>}
        {tab === 'appearance' && <div className="settings-card form-card"><h2>{themeMode === 'dark' ? <Moon size={18} /> : <Sun size={18} />} Appearance</h2><IonSelect label="Theme" labelPlacement="stacked" value={themeMode} onIonChange={(event) => onThemeModeChange(event.detail.value)}><IonSelectOption value="system">System</IonSelectOption><IonSelectOption value="light">Light</IonSelectOption><IonSelectOption value="dark">Dark</IonSelectOption></IonSelect><div className="theme-preview"><div><b>Chat preview</b><p>The refactored UI uses one predictable theme layer.</p></div><span>Aa</span></div></div>}
        {tab === 'privacy' && <div className="settings-card form-card"><h2>Privacy</h2><IonItem lines="none"><IonToggle checked={privacy.readReceipts} onIonChange={(event) => setPrivacy((current) => ({ ...current, readReceipts: event.detail.checked }))}>Read receipts</IonToggle></IonItem><IonSelect label="Last seen" labelPlacement="stacked" value={privacy.lastSeen} onIonChange={(event) => setPrivacy((current) => ({ ...current, lastSeen: event.detail.value }))}><IonSelectOption value="everyone">Everyone</IonSelectOption><IonSelectOption value="nobody">Nobody</IonSelectOption></IonSelect><IonSelect label="Who can message me" labelPlacement="stacked" value={privacy.allowMessages} onIonChange={(event) => setPrivacy((current) => ({ ...current, allowMessages: event.detail.value }))}><IonSelectOption value="everyone">Everyone</IonSelectOption><IonSelectOption value="contacts">Contacts</IonSelectOption></IonSelect><IonButton expand="block" onClick={savePrivacy}>Save privacy</IonButton></div>}
        {tab === 'security' && <div className="settings-card form-card"><h2><Lock size={18} /> Security</h2><IonInput label="Current password" labelPlacement="stacked" type="password" value={password.currentPassword} onIonInput={(event) => setPassword((current) => ({ ...current, currentPassword: event.detail.value || '' }))} /><IonInput label="New password" labelPlacement="stacked" type="password" value={password.newPassword} onIonInput={(event) => setPassword((current) => ({ ...current, newPassword: event.detail.value || '' }))} /><IonButton expand="block" disabled={password.newPassword.length < 8} onClick={changePassword}>Change password</IonButton></div>}
        {tab === 'sessions' && <IonList>{sessions.map((session) => <IonItem key={session.id}><IonLabel><h2>{session.id.slice(0, 10)}</h2><p>Last used: {formatDate(session.last_used_at)}</p></IonLabel><IonButton color="danger" fill="outline" onClick={() => logoutSession(session)}>Logout</IonButton></IonItem>)}</IonList>}
        {tab === 'admin' && <div className="admin-panel">
          <IonItem lines="none"><Shield size={18} /><IonLabel><h2>Admin panel</h2><p>{adminUsers.length} users · {adminChats.length} chats</p></IonLabel></IonItem>
          <h3>Users</h3>
          <IonList>{adminUsers.map((item) => <IonItem key={item.id}><Avatar entity={item} /><IonLabel><h2>{item.displayName || item.username}</h2><p>@{item.username} · {item.role} · {item.isBanned ? 'banned' : 'active'}</p></IonLabel><IonButton color={item.isBanned ? 'success' : 'danger'} fill="outline" disabled={item.id === user.id} onClick={() => toggleBan(item)}>{item.isBanned ? 'Unban' : 'Ban'}</IonButton></IonItem>)}</IonList>
          <h3>Chats</h3>
          <IonSearchbar value={adminQuery} debounce={150} placeholder="Search users, mobile or chats" onIonInput={(event) => setAdminQuery(event.detail.value || '')} />
          <IonList>{filteredAdminChats.slice(0, 250).map((chat) => <IonItem key={chat.id} button detail onClick={() => setSelectedAdminChat(chat)}>
            <MessageSquareText size={18} />
            <IonLabel className="ion-text-wrap">
              <h2>{adminChatTitle(chat)}</h2>
              <p>{chat.type} · {chat.participants?.length || 0} members · {chat.messageCount || 0} messages · {formatDate(chat.lastMessageAt || chat.updatedAt)}</p>
              <p>{chat.lastMessagePreview || 'No messages yet'}</p>
            </IonLabel>
            <IonButton slot="end" color="danger" fill="clear" aria-label="Delete chat permanently" onClick={(event) => { event.stopPropagation(); setDeleteChat(chat); }}><Trash2 size={17} /></IonButton>
          </IonItem>)}</IonList>
        </div>}
      </IonContent>
      <IonToast isOpen={Boolean(toast)} message={toast} duration={2300} onDidDismiss={() => setToast('')} />
      <IonAlert isOpen={Boolean(deleteChat)} header="Delete permanently?" message="The chat, memberships and messages will be permanently removed." buttons={[{ text: 'Cancel', role: 'cancel' }, { text: 'Delete', role: 'destructive', handler: permanentlyDeleteChat }]} onDidDismiss={() => setDeleteChat(null)} />
    </IonModal>
    <AdminChatViewerModal open={Boolean(selectedAdminChat)} chat={selectedAdminChat} onClose={() => setSelectedAdminChat(null)} />
  </>;
}
