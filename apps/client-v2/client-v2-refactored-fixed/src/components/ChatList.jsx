import React, { memo, useMemo } from 'react';
import {
  IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonItemOption,
  IonItemOptions, IonItemSliding, IonLabel, IonList, IonPage, IonRefresher,
  IonRefresherContent, IonSearchbar, IonSegment, IonSegmentButton, IonTitle, IonToolbar,
} from '@ionic/react';
import { BellOff, EyeOff, Pin, Plus, Settings } from 'lucide-react';
import { Avatar } from './Avatar';

function formatChatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (today.getTime() - date.getTime() < 7 * 86400000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatLastSeen(value) {
  if (!value) return 'direct message';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'direct message';
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `last seen today at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
  return `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
}

function chatPreview(chat) {
  const body = String(chat.lastMessageBody || chat.lastMessage?.body || '').trim().replace(/\s+/g, ' ');
  if (body) return body;
  if (chat.lastMessage?.fileName || chat.lastMessageFileName) return chat.lastMessage?.fileName || chat.lastMessageFileName;
  if (chat.type === 'direct') {
    if (chat.peer?.hidePresence) return 'direct message';
    return chat.peer?.isOnline ? 'online' : formatLastSeen(chat.peer?.lastSeenAt);
  }
  if (chat.type === 'saved') return 'Private saved messages';
  if (chat.type === 'rss') return 'RSS channel';
  return 'Group conversation';
}

function matchesFolder(chat, filter, showHidden) {
  if (chat.hidden && !showHidden) return false;
  if (filter === 'archived') return Boolean(chat.archived);
  return !chat.archived;
}

function matchesType(chat, typeFilter) {
  if (typeFilter === 'private') return ['direct', 'saved'].includes(chat.type);
  if (typeFilter === 'groups') return chat.type === 'group';
  if (typeFilter === 'rss') return chat.type === 'rss';
  return true;
}

function ChatRow({ chat, active, onOpen, onArchive }) {
  return (
    <IonItemSliding className={chat.hidden ? 'tiny-hidden-chat' : ''}>
      <IonItem button detail={false} className={active ? 'chat-row active' : 'chat-row'} onClick={() => onOpen(chat)}>
        <Avatar entity={chat} icon={chat.type === 'saved' ? '★' : chat.type === 'group' ? 'G' : chat.type === 'rss' ? 'R' : undefined} />
        <IonLabel>
          <h2>{chat.title || `${chat.type} chat`}</h2>
          <p>{chatPreview(chat)}</p>
        </IonLabel>
        <div className="chat-row-meta"><time>{formatChatTime(chat.lastMessageAt || chat.updatedAt)}</time><span>{chat.hidden && <EyeOff size={14} />}{chat.muted && <BellOff size={14} />}{chat.pinned && <Pin size={14} />}{Number(chat.unreadCount || 0) > 0 && <IonBadge color="primary">{chat.unreadCount}</IonBadge>}</span></div>
      </IonItem>
      {chat.type !== 'saved' && <IonItemOptions side="end">
        <IonItemOption color="medium" onClick={() => onArchive(chat)}>{chat.archived ? 'Unarchive' : 'Archive'}</IonItemOption>
      </IonItemOptions>}
    </IonItemSliding>
  );
}

export const ChatList = memo(function ChatList({
  chats, activeId, query, setQuery, filter, setFilter, typeFilter, setTypeFilter,
  showHidden, onToggleHiddenReveal, onOpen, onNew, onRefresh, onSettings, onArchive,
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const list = useMemo(() => chats.filter((chat) => (
    matchesFolder(chat, filter, showHidden)
    && matchesType(chat, typeFilter)
    && (!normalizedQuery || String(chat.title || '').toLowerCase().includes(normalizedQuery))
  )), [chats, filter, typeFilter, showHidden, normalizedQuery]);

  return (
    <IonPage className={`chat-list-page ${showHidden ? 'tiny-show-hidden-chats' : ''}`}>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle onClick={(event) => { if (event.detail >= 3) onToggleHiddenReveal(); }} title={showHidden ? 'Hidden chats are visible' : undefined}>Tiny Chat</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onSettings} aria-label="Settings"><Settings size={19} /></IonButton>
            <IonButton onClick={onNew} aria-label="New chat"><Plus size={20} /></IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar className="search-toolbar"><IonSearchbar debounce={180} value={query} placeholder="Search chats" onIonInput={(event) => setQuery(event.detail.value || '')} /></IonToolbar>
        <IonToolbar className="folder-toolbar">
          <IonSegment value={filter} onIonChange={(event) => setFilter(event.detail.value)}>
            <IonSegmentButton value="active">Chats</IonSegmentButton>
            <IonSegmentButton value="archived">Archived</IonSegmentButton>
          </IonSegment>
          <div className="tiny-chat-filters" role="group" aria-label="Chat type">
            {[['all','All'],['private','Private'],['groups','Groups'],['rss','RSS']].map(([value,label]) => <button type="button" key={value} className={typeFilter === value ? 'active' : ''} onClick={() => setTypeFilter(value)}>{label}</button>)}
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={async (event) => { try { await onRefresh(); } finally { event.detail.complete(); } }}><IonRefresherContent /></IonRefresher>
        {showHidden && <div className="hidden-mode-note"><EyeOff size={14} />Hidden chats are temporarily visible</div>}
        <IonList lines="none" className="chat-list">
          {list.map((chat) => <ChatRow key={chat.id} chat={chat} active={Number(activeId) === Number(chat.id)} onOpen={onOpen} onArchive={onArchive} />)}
          {!list.length && <div className="list-empty">No chats here.</div>}
        </IonList>
      </IonContent>
    </IonPage>
  );
});
