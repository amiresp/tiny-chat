import React, { memo, useEffect, useRef, useState } from 'react';
import {
  IonAlert, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonProgressBar,
  IonRefresher, IonRefresherContent, IonPage, IonTextarea, IonToolbar,
} from '@ionic/react';
import { ChevronLeft, Image, Info, Mic, Paperclip, Pin, Reply, Search, Send, Smile, Square, Trash2, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { AttachmentPreview } from './AttachmentPreview';
import { EmojiPicker } from './EmojiPicker';
import { snippet } from '../lib/chat';

function PinnedBanner({ message, onJump, onUnpin }) {
  if (!message) return null;
  return <div className="pinned-banner"><Pin size={17} /><button type="button" onClick={onJump}><b>Pinned message</b><small>{snippet(message)}</small></button><IonButton fill="clear" onClick={onUnpin} aria-label="Unpin"><X size={16} /></IonButton></div>;
}

export const ChatRoom = memo(function ChatRoom({
  user, chat, messages, loading, text, setText, replyTo, onCancelReply, onSend,
  onBack, onRefresh, onFile, onInfo, onSearch, onOpenFiles, onSelectMessage,
  onSwipeReply, upload, pinnedMessage, onUnpinPinned, typingUsers, recording,
  recordingSeconds, onStartVoice, onStopVoice, onCancelVoice, onOpenMedia, onDeleteChat, onNewChat, onOpenRss,
}) {
  const contentRef = useRef(null);
  const scrollElementRef = useRef(null);
  const fileRef = useRef(null);
  const touchStart = useRef(null);
  const dragDepth = useRef(0);
  const previousChatId = useRef(null);
  const shouldAutoScroll = useRef(true);
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    contentRef.current?.getScrollElement?.().then((element) => { if (alive) scrollElementRef.current = element; });
    return () => { alive = false; scrollElementRef.current = null; };
  }, [chat?.id]);

  useEffect(() => {
    const changedChat = previousChatId.current !== chat?.id;
    previousChatId.current = chat?.id;
    if (changedChat) { shouldAutoScroll.current = true; setPendingFile(null); setEmojiOpen(false); }
    if (!changedChat && !shouldAutoScroll.current) return;
    requestAnimationFrame(() => contentRef.current?.scrollToBottom?.(changedChat ? 0 : 180));
  }, [chat?.id, messages.length]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (pendingFile) { event.preventDefault(); setPendingFile(null); return; }
      if (emojiOpen) { event.preventDefault(); setEmojiOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingFile, emojiOpen]);

  if (!chat) {
    return <IonPage className="empty-chat"><IonContent className="ion-padding"><div className="empty-state"><img src="/icon.svg" alt="" /><h2>Welcome to Tiny Chat</h2><p>Small but powerful real-time messaging.</p><div className="tiny-empty-actions"><button type="button" onClick={onNewChat}>New Chat</button><button type="button" onClick={onOpenRss}>Open RSS</button></div><small>Press Ctrl / Cmd + K to search your chats</small></div></IonContent></IonPage>;
  }

  function startSwipe(event) {
    const item = event.touches?.[0];
    if (!item || item.clientX > 32) return;
    touchStart.current = { x: item.clientX, y: item.clientY };
  }

  function endSwipe(event) {
    if (!touchStart.current) return;
    const item = event.changedTouches?.[0];
    const dx = item.clientX - touchStart.current.x;
    const dy = Math.abs(item.clientY - touchStart.current.y);
    touchStart.current = null;
    if (dx > 84 && dy < 70) onBack();
  }

  function drop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) setPendingFile(file);
  }

  async function sendPendingFile() {
    const file = pendingFile;
    if (!file) return;
    setPendingFile(null);
    await onFile(file);
  }

  return <>
    <IonPage className={`chat-room-page ${dragging ? 'is-dragging-file' : ''}`} onTouchStart={startSwipe} onTouchEnd={endSwipe} onDragEnter={(event) => { if (event.dataTransfer?.types?.includes('Files')) { dragDepth.current += 1; setDragging(true); } }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragging(false); }} onDrop={drop}>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonButton className="desktop-hidden back-arrow" fill="clear" onClick={onBack} aria-label="Back to chats"><ChevronLeft size={26} /></IonButton></IonButtons>
          <button type="button" className="room-title" onClick={onInfo}><Avatar entity={chat} icon={chat.type === 'saved' ? '★' : chat.type === 'group' ? 'G' : undefined} /><span><b>{chat.title}</b><small>{chat.type === 'direct' && chat.peer?.isOnline ? 'online' : chat.type}</small></span></button>
          <IonButtons slot="end"><IonButton onClick={onSearch} aria-label="Search messages"><Search size={19} /></IonButton><IonButton onClick={onOpenFiles} aria-label="Files"><Image size={19} /></IonButton>{chat.type !== 'saved' && <IonButton color="danger" onClick={() => setConfirmDelete(true)} aria-label="Delete chat"><Trash2 size={18} /></IonButton>}<IonButton onClick={onInfo} aria-label="Chat info"><Info size={19} /></IonButton></IonButtons>
        </IonToolbar>
        {upload && <IonProgressBar value={upload.percent / 100} color="primary" />}
        <PinnedBanner message={pinnedMessage} onJump={() => document.querySelector(`[data-message-id="${pinnedMessage?.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} onUnpin={onUnpinPinned} />
      </IonHeader>
      <IonContent ref={contentRef} className="messages-content" scrollEvents onIonScroll={() => { const element = scrollElementRef.current; if (element) shouldAutoScroll.current = element.scrollHeight - element.scrollTop - element.clientHeight < 140; }}>
        <IonRefresher slot="fixed" onIonRefresh={async (event) => { try { await onRefresh(); } finally { event.detail.complete(); } }}><IonRefresherContent /></IonRefresher>
        {loading && <div className="center-note">Loading…</div>}
        <div className="message-stack">
          {messages.filter((message) => !message.deletedAt).map((message) => <div key={message.id || message.clientId} data-message-id={message.id}><MessageBubble message={message} me={user} onAction={onSelectMessage} onSwipeReply={onSwipeReply} onOpenMedia={onOpenMedia} /></div>)}
          <TypingIndicator users={typingUsers} />
        </div>
      </IonContent>
      {dragging && <div className="file-drop-overlay"><Paperclip size={28} /><b>Drop file to send</b></div>}
      {chat.type !== 'rss' && <IonFooter className="composer-footer">
        {replyTo && <div className="reply-composer"><Reply size={16} /><span><b>Replying</b><small>{snippet(replyTo)}</small></span><IonButton fill="clear" onClick={onCancelReply}><X size={16} /></IonButton></div>}
        {recording && <div className="voice-recorder"><span className="record-dot" /><b>Recording voice</b><small>{recordingSeconds}s</small><IonButton fill="clear" color="danger" onClick={onCancelVoice}><X size={16} /></IonButton><IonButton fill="solid" onClick={onStopVoice}><Send size={16} />Send</IonButton></div>}
        <input ref={fileRef} type="file" hidden onChange={(event) => { const selected = event.target.files?.[0]; if (selected) setPendingFile(selected); event.target.value = ''; }} />
        <div className="composer-bar">
          <IonButton fill="clear" disabled={recording} onClick={() => setEmojiOpen((value) => !value)} aria-label="Emoji"><Smile size={20} /></IonButton>
          <IonButton fill="clear" disabled={recording} onClick={() => fileRef.current?.click()} aria-label="Attach file"><Paperclip size={20} /></IonButton>
          <IonTextarea autoGrow rows={1} placeholder={recording ? 'Recording…' : 'Message'} value={text} disabled={recording} onIonInput={(event) => setText(event.detail.value || '')} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) { event.preventDefault(); onSend(); } }} />
          <IonButton fill={recording ? 'solid' : 'clear'} color={recording ? 'danger' : 'primary'} onClick={recording ? onStopVoice : onStartVoice} aria-label={recording ? 'Stop recording' : 'Record voice'}>{recording ? <Square size={18} /> : <Mic size={20} />}</IonButton>
          <IonButton onClick={onSend} disabled={!text.trim() || recording} aria-label="Send message"><Send size={18} /></IonButton>
          <EmojiPicker open={emojiOpen} onClose={() => setEmojiOpen(false)} onPick={(emoji) => { setText(`${text}${emoji}`); }} />
        </div>
      </IonFooter>}
    </IonPage>
    <AttachmentPreview file={pendingFile} onCancel={() => setPendingFile(null)} onSend={sendPendingFile} />
    <IonAlert isOpen={confirmDelete} header="Delete this chat?" message="This conversation will be removed from your chat list on this account." buttons={[{ text: 'Cancel', role: 'cancel' }, { text: 'Delete', role: 'destructive', handler: () => { setConfirmDelete(false); onDeleteChat(); } }]} onDidDismiss={() => setConfirmDelete(false)} />
  </>;
});
