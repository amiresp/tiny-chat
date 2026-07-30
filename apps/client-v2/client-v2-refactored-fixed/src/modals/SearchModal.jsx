import React, { useEffect, useRef, useState } from 'react';
import { IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonModal, IonSearchbar, IonTitle, IonToast, IonToolbar } from '@ionic/react';
import { X } from 'lucide-react';
import { api } from '../api';
import { formatDate } from '../lib/chat';

export function SearchModal({ open, chat, onClose, onJump }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [toast, setToast] = useState('');
  const generationRef = useRef(0);

  useEffect(() => {
    if (!open || !term.trim() || !chat) {
      setResults([]);
      return undefined;
    }
    const generation = ++generationRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const data = await api(`/api/v2/chats/${chat.id}/search?q=${encodeURIComponent(term.trim())}`);
        if (generation === generationRef.current) setResults(data.messages || []);
      } catch (error) {
        if (generation === generationRef.current) setToast(error.message);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [term, open, chat?.id]);

  return <IonModal isOpen={open} onDidDismiss={onClose}>
    <IonHeader><IonToolbar><IonTitle>Search</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar><IonToolbar><IonSearchbar value={term} onIonInput={(event) => setTerm(event.detail.value || '')} /></IonToolbar></IonHeader>
    <IonContent><IonList>{results.map((message) => <IonItem button key={message.id} onClick={() => { onJump?.(message); onClose(); }}><IonLabel><h2>{message.body || message.fileName || 'Message'}</h2><p>{formatDate(message.createdAt)}</p></IonLabel></IonItem>)}</IonList></IonContent>
    <IonToast isOpen={Boolean(toast)} message={toast} duration={2400} onDidDismiss={() => setToast('')} />
  </IonModal>;
}
