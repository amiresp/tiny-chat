import React, { useEffect, useState } from 'react';
import {
  IonAlert, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel,
  IonList, IonModal, IonTitle, IonToast, IonToolbar,
} from '@ionic/react';
import { Archive, Bell, BellOff, Eye, EyeOff, Pin, PinOff, Trash2, UserPlus, UserX, X } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { api } from '../api';

export function ChatInfoModal({ open, chat, info, user, onClose, onCreateInvite, onPreference, onBlockPeer, onToggleHidden, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isContact, setIsContact] = useState(false);
  const [toast, setToast] = useState('');
  const peer = chat?.type === 'direct'
    ? (info?.members || []).find((member) => Number(member.id) !== Number(user?.id))
    : null;

  useEffect(() => {
    if (!open || !peer?.id) { setIsContact(false); return undefined; }
    let alive = true;
    api('/api/v2/contacts').then((data) => { if (alive) setIsContact((data.contacts || []).some((item) => Number(item.id) === Number(peer.id))); }).catch(() => {});
    return () => { alive = false; };
  }, [open, peer?.id]);

  async function toggleContact() {
    if (!peer?.id) return;
    try {
      if (isContact) await api(`/api/v2/contacts/${peer.id}`, { method: 'DELETE' });
      else await api('/api/v2/contacts', { method: 'POST', body: JSON.stringify({ userId: peer.id }) });
      setIsContact((value) => !value);
      setToast(isContact ? 'Contact removed' : 'Contact added');
    } catch (error) { setToast(error.message); }
  }

  return <IonModal isOpen={open} onDidDismiss={onClose} cssClass="chat-info-modal">
    <IonHeader><IonToolbar><IonTitle>Chat info</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar></IonHeader>
    <IonContent className="ion-padding">
      <div className="info-hero"><Avatar entity={peer || chat} icon={chat?.type === 'group' ? 'G' : chat?.type === 'saved' ? '★' : undefined} /><h2>{peer?.display_name || peer?.displayName || chat?.title}</h2><p>{peer?.username ? `@${peer.username}` : chat?.type}</p>{peer?.mobile && <small>{peer.mobile}</small>}</div>
      <div className="info-actions">
        <IonButton fill="outline" onClick={() => onPreference('pinned')}>{chat?.pinned ? <PinOff size={16} /> : <Pin size={16} />}{chat?.pinned ? 'Unpin chat' : 'Pin chat'}</IonButton>
        <IonButton fill="outline" onClick={() => onPreference('muted')}>{chat?.muted ? <Bell size={16} /> : <BellOff size={16} />}{chat?.muted ? 'Unmute' : 'Mute'}</IonButton>
        <IonButton fill="outline" onClick={() => onPreference('archived')}><Archive size={16} />{chat?.archived ? 'Unarchive' : 'Archive'}</IonButton>
        {chat?.type !== 'saved' && <IonButton fill="outline" color="medium" onClick={onToggleHidden}>{chat?.hidden ? <Eye size={16} /> : <EyeOff size={16} />}{chat?.hidden ? 'Unhide chat' : 'Hide chat'}</IonButton>}
        {peer && <IonButton fill="outline" onClick={toggleContact}><UserPlus size={16} />{isContact ? 'Remove contact' : 'Add contact'}</IonButton>}
        {peer && <IonButton color="danger" fill="outline" onClick={() => onBlockPeer(peer.id)}><UserX size={16} />Block user</IonButton>}
        {chat?.type !== 'saved' && <IonButton color="danger" fill="outline" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Delete chat</IonButton>}
      </div>
      {info?.pinnedMessage && <IonItem lines="none"><Pin size={16} /><IonLabel><h2>Pinned message</h2><p>{info.pinnedMessage.body || info.pinnedMessage.fileName || 'Attachment'}</p></IonLabel></IonItem>}
      {!!(info?.members || []).length && <><h3 className="info-section-title">Members</h3><IonList>{(info?.members || []).map((member) => <IonItem key={member.id}><Avatar entity={{ displayName: member.display_name, username: member.username, avatarUrl: member.avatar_url }} /><IonLabel><h2>{member.display_name || member.username}</h2><p>{member.role}{member.username ? ` · @${member.username}` : ''}</p></IonLabel></IonItem>)}</IonList></>}
      {chat?.type === 'group' && <IonButton expand="block" onClick={onCreateInvite}>Create invite link</IonButton>}
    </IonContent>
    <IonAlert isOpen={confirmDelete} header="Delete this chat?" message="This conversation will be removed from your chat list on this account." buttons={[{ text: 'Cancel', role: 'cancel', handler: () => setConfirmDelete(false) }, { text: 'Delete', role: 'destructive', handler: () => { setConfirmDelete(false); onDelete(); } }]} onDidDismiss={() => setConfirmDelete(false)} />
    <IonToast isOpen={Boolean(toast)} message={toast} duration={2000} onDidDismiss={() => setToast('')} />
  </IonModal>;
}
