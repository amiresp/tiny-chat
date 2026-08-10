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

function formatLastSeen(value) {
  if (!value) return 'offline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'offline';
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `last seen today at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
  return `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
}

function chatSubtitle(chat) {
  if (chat?.type !== 'direct') return chat?.type || '';
  if (chat.peer?.hidePresence) return 'direct message';
  if (chat.peer?.isOnline) return 'online';
  return formatLastSeen(chat.peer?.lastSeenAt);
}

function normalizeClipboardImage(file) {
  if (!file || !String(file.type || '').startsWith('image/')) return null;
  if (file.name && !/^image\.(?:png|jpe?g|webp|gif|bmp)$/i.test(file.name)) return file;
  const subtype = String(file.type || 'image/png').split('/')[1]?.toLowerCase() || 'png';
  const extensionMap = { jpeg: 'jpg', 'svg+xml': 'svg' };
  const extension = extensionMap[subtype] || subtype.replace(/[^a-z0-9]/g, '') || 'png';
  return new File([file], `pasted-image-${Date.now()}.${extension}`, {
    type: file.type || 'image/png',
    lastModified: Date.now(),
  });
}

function pastedImageFile(event) {
  const clipboard = event.clipboardData;
  if (!clipboard) return null;

  for (const file of Array.from(clipboard.files || [])) {
    const normalized = normalizeClipboardImage(file);
    if (normalized) return normalized;
  }

  for (const item of Array.from(clipboard.items || [])) {
    if (item.kind !== 'file' || !String(item.type || '').startsWith('image/')) continue;
    const normalized = normalizeClipboardImage(item.getAsFile?.());
    if (normalized) return normalized;
  }

  return null;
}

async function readImageFromClipboardApi() {
  if (!navigator.clipboard?.read) return null;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types?.find((type) => String(type).startsWith('image/'));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      return normalizeClipboardImage(new File([blob], 'image.png', { type: imageType }));
    }
  } catch {
    // The browser can deny clipboard-read permission. Normal paste still works via ClipboardEvent.
  }
  return null;
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
  const textareaRef = useRef(null);
  const touchStart = useRef(null);
  const dragDepth = useRef(0);
  const previousChatId = useRef(null);
  const shouldAutoScroll = useRef(true);
  const clipboardHandledAt = useRef(0);
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

  // Primary path: capture image paste at document level while a real chat is open.
  // This is intentionally independent from Ionic's input/shadow DOM.
  useEffect(() => {
    if (!chat?.id || chat.type === 'rss') return undefined;

    const handleDocumentPaste = (event) => {
      if (recording) return;
      const file = pastedImageFile(event);
      if (!file) return;

      clipboardHandledAt.current = Date.now();
      event.preventDefault();
      event.stopPropagation();
      setEmojiOpen(false);
      setPendingFile(file);
    };

    document.addEventListener('paste', handleDocumentPaste, true);
    return () => document.removeEventListener('paste', handleDocumentPaste, true);
  }, [chat?.id, chat?.type, recording]);

  // Keep the native Ionic textarea listener only as a secondary fallback.
  useEffect(() => {
    if (!chat?.id || chat.type === 'rss') return undefined;
    let cancelled = false;
    let nativeTextarea = null;

    const handleNativePaste = (event) => {
      if (recording || Date.now() - clipboardHandledAt.current < 300) return;
      const file = pastedImageFile(event);
      if (!file) return;

      clipboardHandledAt.current = Date.now();
      event.preventDefault();
      event.stopPropagation();
      setEmojiOpen(false);
      setPendingFile(file);
    };

    Promise.resolve(textareaRef.current?.getInputElement?.())
      .then((element) => {
        if (cancelled || !element) return;
        nativeTextarea = element;
        nativeTextarea.addEventListener('paste', handleNativePaste, true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      nativeTextarea?.removeEventListener('paste', handleNativePaste, true);
    };
  }, [chat?.id, chat?.type, recording]);

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

  async function pasteImageFromClipboard() {
    if (recording) return;
    const file = await readImageFromClipboardApi();
    if (!file) return;
    clipboardHandledAt.current = Date.now();
    setEmojiOpen(false);
    setPendingFile(file);
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
          <button type="button" className="room-title" onClick={onInfo}><Avatar entity={chat} icon={chat.type === 'saved' ? '★' : chat.type === 'group' ? 'G' : undefined} /><span><b>{chat.title}</b><small>{chatSubtitle(chat)}</small></span></button>
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
          <IonButton fill="clear" disabled={recording} onClick={pasteImageFromClipboard} aria-label="Paste image" title="Paste image from clipboard"><Image size={20} /></IonButton>
          <IonTextarea ref={textareaRef} autoGrow rows={1} placeholder={recording ? 'Recording…' : 'Message'} value={text} disabled={recording} onIonInput={(event) => setText(event.detail.value || '')} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) { event.preventDefault(); onSend(); } }} />
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
