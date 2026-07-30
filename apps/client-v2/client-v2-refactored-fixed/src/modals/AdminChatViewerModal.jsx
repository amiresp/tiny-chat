import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { Download, MessageSquareText, X } from 'lucide-react';
import { api, assetUrl } from '../api';
import { Avatar } from '../components/Avatar';
import { formatDate } from '../lib/chat';
import '../styles/admin-audit.css';

function userName(user) {
  return user?.displayName || user?.username || (user?.id ? `User #${user.id}` : 'Unknown user');
}

function messageDescription(message) {
  if (message.body) return message.body;
  if (message.fileName) return message.fileName;
  if (message.type === 'voice') return 'Voice message';
  if (message.type === 'image') return 'Image';
  if (message.type === 'video') return 'Video';
  if (message.type === 'file') return 'File';
  return 'Empty message';
}

export function AdminChatViewerModal({ open, chat, onClose }) {
  const chatId = chat?.id;
  const [detail, setDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState('');

  const loadPage = useCallback(async ({ before = null, prepend = false } = {}) => {
    if (!chatId) return;
    const query = new URLSearchParams({ limit: '200' });
    if (before) query.set('before', String(before));
    const data = await api(`/api/v2/admin/audit/chats/${chatId}/messages?${query}`);
    if (data.chat) setDetail(data.chat);
    setHasMore(Boolean(data.hasMore));
    setNextBefore(data.nextBefore || null);
    setMessages((current) => {
      const incoming = data.messages || [];
      if (!prepend) return incoming;
      const byId = new Map([...incoming, ...current].map((message) => [Number(message.id), message]));
      return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
    });
  }, [chatId]);

  useEffect(() => {
    if (!open || !chatId) return undefined;
    let alive = true;
    setDetail(chat);
    setMessages([]);
    setHasMore(false);
    setNextBefore(null);
    setError('');
    setLoading(true);

    loadPage()
      .catch((requestError) => { if (alive) setError(requestError.message || 'Could not load chat history.'); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [open, chatId, loadPage]);

  const participants = detail?.participants || chat?.participants || [];
  const title = detail?.displayTitle || chat?.displayTitle || chat?.title || `Chat #${chatId || ''}`;
  const participantText = useMemo(
    () => participants.map((participant) => `${userName(participant)} (@${participant.username || '—'})`).join(' · '),
    [participants],
  );

  async function loadOlder() {
    if (!nextBefore || loadingOlder) return;
    setLoadingOlder(true);
    setError('');
    try {
      await loadPage({ before: nextBefore, prepend: true });
    } catch (requestError) {
      setError(requestError.message || 'Could not load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  }

  return <IonModal isOpen={open} onDidDismiss={onClose} cssClass="admin-chat-viewer-modal">
    <IonHeader>
      <IonToolbar>
        <IonTitle>{title}</IonTitle>
        <IonButtons slot="end"><IonButton onClick={onClose} aria-label="Close chat history"><X size={18} /></IonButton></IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <IonItem lines="full" className="admin-chat-audit-summary">
        <MessageSquareText size={19} />
        <IonLabel className="ion-text-wrap">
          <h2>{title}</h2>
          <p>{participantText || 'No participants'}</p>
          <p>{detail?.type || chat?.type} · Chat #{detail?.id || chatId}</p>
        </IonLabel>
      </IonItem>

      {hasMore && <IonButton expand="block" fill="outline" disabled={loadingOlder} onClick={loadOlder}>
        {loadingOlder ? <IonSpinner name="crescent" /> : 'Load older messages'}
      </IonButton>}

      {loading && <div className="admin-chat-audit-state"><IonSpinner name="crescent" /><span>Loading chat history…</span></div>}
      {error && <IonNote color="danger" className="admin-chat-audit-error">{error}</IonNote>}
      {!loading && !error && messages.length === 0 && <div className="admin-chat-audit-state">No messages in this chat.</div>}

      {!loading && messages.length > 0 && <IonList className="admin-chat-audit-list">
        {messages.map((message) => {
          const sender = message.sender || { id: message.senderId };
          const fileHref = message.fileUrl && !message.fileExpired ? assetUrl(message.fileUrl) : null;
          return <IonItem key={message.id} className="admin-chat-audit-message" lines="full">
            <Avatar entity={sender} />
            <IonLabel className="ion-text-wrap">
              <h2>{userName(sender)} <IonNote>@{sender.username || '—'}</IonNote></h2>
              <p className="admin-chat-audit-meta">{formatDate(message.createdAt)} · {message.type || 'text'}{message.editedAt ? ' · edited' : ''}{message.deletedAt ? ' · deleted' : ''}</p>
              <div className="admin-chat-audit-body">{messageDescription(message)}</div>
              {message.replyToId && <p>Reply to message #{message.replyToId}</p>}
              {fileHref && <a href={fileHref} target="_blank" rel="noreferrer" className="admin-chat-audit-file"><Download size={15} />{message.fileName || 'Open attachment'}</a>}
              {message.fileUrl && message.fileExpired && <IonNote color="medium">Attachment expired</IonNote>}
            </IonLabel>
          </IonItem>;
        })}
      </IonList>}
    </IonContent>
  </IonModal>;
}
