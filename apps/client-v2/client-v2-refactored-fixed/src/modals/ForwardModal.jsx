import React, { useMemo } from 'react';
import { IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonModal, IonTitle, IonToolbar } from '@ionic/react';
import { X } from 'lucide-react';
import { Avatar } from '../components/Avatar';

export function ForwardModal({ open, chats, activeId, onClose, onForward }) {
  const targets = useMemo(() => chats.filter((chat) => Number(chat.id) !== Number(activeId) && chat.type !== 'rss' && !chat.hidden), [chats, activeId]);
  return <IonModal isOpen={open} onDidDismiss={onClose} breakpoints={[0, 0.75, 1]} initialBreakpoint={0.75}>
    <IonHeader><IonToolbar><IonTitle>Forward to…</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar></IonHeader>
    <IonContent><IonList lines="none">{targets.map((chat) => <IonItem button key={chat.id} onClick={() => onForward(chat)}><Avatar entity={chat} icon={chat.type === 'saved' ? '★' : chat.type === 'group' ? 'G' : undefined} /><IonLabel><h2>{chat.title}</h2><p>{chat.type}</p></IonLabel></IonItem>)}</IonList></IonContent>
  </IonModal>;
}
