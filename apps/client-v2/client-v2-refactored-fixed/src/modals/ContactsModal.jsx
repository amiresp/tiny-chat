import React, { useEffect, useMemo, useState } from 'react';
import { IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonModal, IonSearchbar, IonTitle, IonToast, IonToolbar } from '@ionic/react';
import { MessageCircle, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { Avatar } from '../components/Avatar';

export function ContactsModal({ open, onClose, onOpenChat }) {
  const [contacts, setContacts] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [toast, setToast] = useState('');
  const contactIds = useMemo(() => new Set(contacts.map((item) => Number(item.id))), [contacts]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setQuery(''); setResults([]);
    api('/api/v2/contacts').then((data) => alive && setContacts(data.contacts || [])).catch((error) => alive && setToast(error.message));
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); return undefined; }
    let alive = true;
    const timer = window.setTimeout(() => {
      api(`/api/v2/contacts/search?q=${encodeURIComponent(query.trim())}`)
        .then((data) => alive && setResults((data.users || []).map((user) => ({ ...user, added: contactIds.has(Number(user.id)) }))))
        .catch((error) => alive && setToast(error.message));
    }, 260);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query, open, contactIds]);

  async function startChat(user) {
    try {
      const result = await api('/api/chats/direct', { method: 'POST', body: JSON.stringify({ userId: user.id }) });
      onClose();
      await onOpenChat(result.chat || result);
    } catch (error) { setToast(error.message); }
  }

  async function add(user) {
    try {
      await api('/api/v2/contacts', { method: 'POST', body: JSON.stringify({ userId: user.id }) });
      setContacts((list) => list.some((item) => Number(item.id) === Number(user.id)) ? list : [...list, user]);
      setResults((list) => list.map((item) => Number(item.id) === Number(user.id) ? { ...item, added: true } : item));
      setToast('Contact added');
    } catch (error) { setToast(error.message); }
  }

  async function remove(user) {
    try {
      await api(`/api/v2/contacts/${user.id}`, { method: 'DELETE' });
      setContacts((list) => list.filter((item) => Number(item.id) !== Number(user.id)));
      setResults((list) => list.map((item) => Number(item.id) === Number(user.id) ? { ...item, added: false } : item));
      setToast('Contact removed');
    } catch (error) { setToast(error.message); }
  }

  function row(user, search = false) {
    const added = search ? Boolean(user.added) : true;
    return <IonItem key={`${search ? 's' : 'c'}-${user.id}`}>
      <Avatar entity={user} />
      <IonLabel><h2>{user.displayName || user.display_name || user.username || 'User'}</h2><p>{user.username ? `@${user.username}` : user.mobile || ''}{user.isOnline ? ' · online' : ''}</p></IonLabel>
      {!added && <IonButton fill="outline" onClick={() => add(user)} aria-label="Add contact"><Plus size={16} />Add</IonButton>}
      <IonButton fill="outline" onClick={() => startChat(user)} aria-label="Message"><MessageCircle size={16} /></IonButton>
      {added && <IonButton fill="clear" color="danger" onClick={() => remove(user)} aria-label="Remove contact"><Trash2 size={16} /></IonButton>}
    </IonItem>;
  }

  return <IonModal isOpen={open} onDidDismiss={onClose} cssClass="contacts-modal">
    <IonHeader><IonToolbar><IonTitle>Contacts</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar><IonToolbar><IonSearchbar value={query} debounce={0} placeholder="Search username or mobile" onIonInput={(event) => setQuery(event.detail.value || '')} /></IonToolbar></IonHeader>
    <IonContent className="ion-padding">
      {query.trim().length >= 2 && <section className="contacts-section"><div className="contacts-title"><h2>Search results</h2><span>{results.length}</span></div><IonList>{results.map((user) => row(user, true))}{!results.length && <div className="list-empty">No users found.</div>}</IonList></section>}
      <section className="contacts-section"><div className="contacts-title"><h2>Your contacts</h2><span>{contacts.length}</span></div><IonList>{contacts.map((user) => row(user))}{!contacts.length && <div className="list-empty">No contacts yet.</div>}</IonList></section>
    </IonContent>
    <IonToast isOpen={Boolean(toast)} message={toast} duration={2200} onDidDismiss={() => setToast('')} />
  </IonModal>;
}
