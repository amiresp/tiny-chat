import React, { useEffect, useRef, useState } from 'react';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList,
  IonModal, IonSearchbar, IonSegment, IonSegmentButton, IonTitle, IonToast, IonToolbar,
} from '@ionic/react';
import { X } from 'lucide-react';
import { api } from '../api';
import { Avatar } from '../components/Avatar';

export function NewChatModal({ open, onClose, onCreated }) {
  const [type, setType] = useState('direct');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState('');
  const [rss, setRss] = useState('');
  const [toast, setToast] = useState('');
  const searchGeneration = useRef(0);

  useEffect(() => {
    if (!open || query.trim().length < 2 || type === 'rss') {
      setUsers([]);
      return undefined;
    }
    const generation = ++searchGeneration.current;
    const timer = window.setTimeout(async () => {
      try {
        const data = await api(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        if (generation === searchGeneration.current) setUsers(data.users || []);
      } catch (error) {
        if (generation === searchGeneration.current) setToast(error.message);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, open, type]);

  async function create(user) {
    try {
      const data = type === 'rss'
        ? await api('/api/v2/rss', { method: 'POST', body: JSON.stringify({ title, url: rss }) })
        : type === 'group'
          ? await api('/api/chats/group', { method: 'POST', body: JSON.stringify({ title, memberIds: user ? [user.id] : [] }) })
          : await api('/api/chats/direct', { method: 'POST', body: JSON.stringify({ userId: user.id }) });
      onCreated(data.chat);
      setQuery('');
      setTitle('');
      setRss('');
    } catch (error) {
      setToast(error.message);
    }
  }

  return <IonModal isOpen={open} onDidDismiss={onClose} breakpoints={[0, 0.75, 1]} initialBreakpoint={0.75}>
    <IonHeader><IonToolbar><IonTitle>New chat</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar></IonHeader>
    <IonContent className="ion-padding">
      <IonSegment value={type} onIonChange={(event) => setType(event.detail.value)}><IonSegmentButton value="direct">Direct</IonSegmentButton><IonSegmentButton value="group">Group</IonSegmentButton><IonSegmentButton value="rss">RSS</IonSegmentButton></IonSegment>
      {type !== 'direct' && <IonInput label="Title" labelPlacement="stacked" value={title} onIonInput={(event) => setTitle(event.detail.value || '')} />}
      {type === 'rss' ? <><IonInput label="RSS URL" labelPlacement="stacked" value={rss} onIonInput={(event) => setRss(event.detail.value || '')} /><IonButton expand="block" disabled={!title.trim() || !rss.trim()} onClick={() => create()}>Add RSS</IonButton></> : <><IonSearchbar value={query} placeholder="Search users" onIonInput={(event) => setQuery(event.detail.value || '')} /><IonList>{users.map((candidate) => <IonItem button key={candidate.id} onClick={() => create(candidate)}><Avatar entity={candidate} /><IonLabel><h2>{candidate.displayName || candidate.username}</h2><p>@{candidate.username}</p></IonLabel></IonItem>)}</IonList></>}
    </IonContent>
    <IonToast isOpen={Boolean(toast)} message={toast} duration={2500} onDidDismiss={() => setToast('')} />
  </IonModal>;
}
