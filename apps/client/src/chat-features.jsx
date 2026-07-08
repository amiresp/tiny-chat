import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquareReply,
  MoreHorizontal,
  Pin,
  SendToBack,
  Trash2,
  X,
} from 'lucide-react';
import { apiOrigin } from './runtime';
import './chat-features.css';

const ESTIMATED_HEIGHT = 132;
const OVERSCAN = 8;
const REPLY_SWIPE_THRESHOLD = 62;
const REPLY_SWIPE_LIMIT = 86;
const LONG_PRESS_MS = 520;

function assetUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? `${apiOrigin}${value}` : value;
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function messageStatus(message, mine) {
  if (!mine) return '';
  if (message.status === 'queued') return 'queued';
  if (message.status === 'failed' || message.failedAt) return 'failed';
  if (message.readAt) return 'seen';
  if (message.deliveredAt) return 'delivered';
  return 'sent';
}

function MessageActions({ message, mine, onEdit, onDelete, onSelect, onPin, onSave, onForward }) {
  const [open, setOpen] = useState(false);

  if (message.deletedAt) return null;

  return (
    <div className="message-actions compact-actions">
      <button title="More" onClick={() => setOpen((value) => !value)}><MoreHorizontal /></button>

      {open && (
        <div className="message-action-menu">
          <button onClick={() => { navigator.clipboard?.writeText(message.body || message.fileName || ''); setOpen(false); }}><Copy />Copy</button>
          <button onClick={() => { onSelect(message); setOpen(false); }}><Bookmark />Select</button>
          <button onClick={() => { onSave(message); setOpen(false); }}><Bookmark />Save</button>
          <button onClick={() => { onForward(message); setOpen(false); }}><SendToBack />Forward</button>
          <button onClick={() => { onPin(message); setOpen(false); }}><Pin />Pin</button>
          {mine && message.type === 'text' && <button onClick={() => { onEdit(message); setOpen(false); }}><Edit3 />Edit</button>}
          {mine && <button className="danger" onClick={() => { onDelete(message); setOpen(false); }}><Trash2 />Delete</button>}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  user,
  selected,
  selectionMode,
  onReply,
  onEdit,
  onDelete,
  onOpenMedia,
  onToggleSelect,
  onPin,
  onSave,
  onForward,
}) {
  const mine = Number(message.senderId) === Number(user.id);
  const url = assetUrl(message.fileUrl);
  const image = message.mimeType?.startsWith('image/');
  const video = message.mimeType?.startsWith('video/');
  const audio = message.mimeType?.startsWith('audio/') || message.type === 'voice';
  const swipe = useRef(null);
  const replyTimer = useRef(null);
  const longPress = useRef(null);
  const [swipeX, setSwipeX] = useState(0);
  const [replyFired, setReplyFired] = useState(false);
  const canSwipeReply = !message.deletedAt && !selectionMode;
  const status = messageStatus(message, mine);

  useEffect(() => () => {
    window.clearTimeout(replyTimer.current);
    window.clearTimeout(longPress.current);
  }, []);

  function startLongPress() {
    if (message.deletedAt) return;
    window.clearTimeout(longPress.current);
    longPress.current = window.setTimeout(() => {
      navigator.vibrate?.(6);
      onToggleSelect(message);
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    window.clearTimeout(longPress.current);
  }

  function touchStart(event) {
    startLongPress();
    if (!canSwipeReply || event.touches.length !== 1 || replyFired) return;
    const touch = event.touches[0];
    swipe.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      active: false,
    };
  }

  function touchMove(event) {
    cancelLongPress();
    if (!swipe.current || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - swipe.current.startX;
    const deltaY = touch.clientY - swipe.current.startY;
    const effectiveDeltaX = mine ? -deltaX : deltaX;

    if (!swipe.current.active) {
      if (Math.abs(deltaY) > 12 && Math.abs(deltaY) > Math.abs(deltaX)) {
        swipe.current = null;
        setSwipeX(0);
        return;
      }
      if (effectiveDeltaX > 12 && effectiveDeltaX > Math.abs(deltaY) * 1.25) {
        swipe.current.active = true;
      }
    }

    if (!swipe.current?.active) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(REPLY_SWIPE_LIMIT, effectiveDeltaX));
    setSwipeX(next);
  }

  function touchEnd() {
    cancelLongPress();
    if (!swipe.current) return;
    const shouldReply = swipe.current.active && swipeX >= REPLY_SWIPE_THRESHOLD;
    swipe.current = null;

    if (!shouldReply) {
      setSwipeX(0);
      return;
    }

    navigator.vibrate?.(6);
    setReplyFired(true);
    setSwipeX(REPLY_SWIPE_LIMIT);
    replyTimer.current = window.setTimeout(() => {
      setSwipeX(0);
      setReplyFired(false);
      onReply(message);
    }, 140);
  }

  function clickMessage(event) {
    if (!selectionMode) return;
    event.preventDefault();
    onToggleSelect(message);
  }

  return (
    <article
      className={`message-row ${mine ? 'mine' : ''} ${selected ? 'selected-message' : ''} ${swipeX ? 'swiping-reply' : ''} ${replyFired ? 'reply-fired' : ''}`}
      style={{ '--reply-swipe': `${swipeX}px` }}
      onTouchStart={touchStart}
      onTouchMove={touchMove}
      onTouchEnd={touchEnd}
      onTouchCancel={touchEnd}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onClick={clickMessage}
    >
      {selectionMode && <span className="message-select-dot">{selected ? '✓' : ''}</span>}
      {canSwipeReply && (
        <span className="swipe-reply-cue" aria-hidden="true">
          <MessageSquareReply />
        </span>
      )}

      <div className={`bubble ${mine ? 'mine' : ''} ${message.deletedAt ? 'deleted' : ''}`}>
        {!selectionMode && <MessageActions message={message} mine={mine} onEdit={onEdit} onDelete={onDelete} onSelect={onToggleSelect} onPin={onPin} onSave={onSave} onForward={onForward} />}

        {message.replyTo && (
          <button className="reply-preview" onClick={() => document.querySelector(`[data-message-id="${message.replyTo.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            <b>{message.replyTo.senderName}</b>
            <span>{message.replyTo.body}</span>
          </button>
        )}

        {message.forwardedFromId && <small className="forwarded-label">Forwarded</small>}

        {message.deletedAt ? (
          <p className="deleted-message">Message deleted</p>
        ) : (
          <>
            {message.body && <p>{message.body}</p>}
            {image && url && <button className="media-preview" onClick={() => onOpenMedia(message)}><img src={url} alt={message.fileName || 'Shared image'} loading="lazy" /></button>}
            {video && url && <button className="media-preview" onClick={() => onOpenMedia(message)}><video src={url} preload="metadata" /></button>}
            {audio && url && <audio controls src={url} preload="metadata" />}
            {url && !image && !video && !audio && <a href={url} download={message.fileName || undefined}>{message.fileName || 'Download file'}</a>}
            {url && (image || video) && <a className="media-download" href={url} download={message.fileName || undefined}><Download />Download</a>}
          </>
        )}

        {message.reactions?.length > 0 && (
          <div className="message-reactions read-only-reactions">
            {message.reactions.map((reaction) => (
              <span key={reaction.emoji} className={reaction.reacted ? 'reacted' : ''}>
                {reaction.emoji}<small>{reaction.count}</small>
              </span>
            ))}
          </div>
        )}

        <time>{formatTime(message.createdAt)}{message.editedAt ? ' · edited' : ''}{status ? ` · ${status}` : ''}</time>
      </div>
    </article>
  );
}

export function VirtualMessageList({
  messages,
  user,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onOpenMedia,
  selectedMessages = new Set(),
  selectionMode = false,
  onToggleSelect,
  onPin,
  onSave,
  onForward,
  onPullRefresh,
}) {
  const container = useRef(null);
  const pull = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(700);
  const wasAtBottom = useRef(true);
  const previousCount = useRef(messages.length);

  useEffect(() => {
    if (!container.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    if (messages.length > previousCount.current && wasAtBottom.current) {
      requestAnimationFrame(() => element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' }));
    }
    previousCount.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    const element = container.current;
    if (element && messages.length) requestAnimationFrame(() => { element.scrollTop = element.scrollHeight; });
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / ESTIMATED_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(height / ESTIMATED_HEIGHT) + OVERSCAN * 2;
  const end = Math.min(messages.length, start + visibleCount);
  const visible = messages.slice(start, end);
  const topSpace = start * ESTIMATED_HEIGHT;
  const bottomSpace = Math.max(0, (messages.length - end) * ESTIMATED_HEIGHT);

  function handleScroll(event) {
    const element = event.currentTarget;
    setScrollTop(element.scrollTop);
    wasAtBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    if (element.scrollTop < 180 && hasMore && !loadingOlder) onLoadOlder();
  }

  function touchStart(event) {
    if (container.current?.scrollTop > 0 || event.touches.length !== 1) return;
    pull.current = { y: event.touches[0].clientY, active: true };
  }

  function touchEnd(event) {
    if (!pull.current) return;
    const diff = event.changedTouches?.[0] ? event.changedTouches[0].clientY - pull.current.y : 0;
    pull.current = null;
    if (diff > 70) onPullRefresh?.();
  }

  return (
    <section className="messages virtual-messages" ref={container} onScroll={handleScroll} onTouchStart={touchStart} onTouchEnd={touchEnd}>
      {loadingOlder && <div className="older-loader"><Loader2 className="spin" />Loading older messages…</div>}
      <div style={{ height: topSpace }} aria-hidden="true" />
      {visible.map((message) => (
        <div key={message.id || message.clientId} data-message-id={message.id} className="virtual-message-item">
          <MessageBubble
            message={message}
            user={user}
            selected={selectedMessages.has(Number(message.id))}
            selectionMode={selectionMode}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenMedia={onOpenMedia}
            onToggleSelect={onToggleSelect}
            onPin={onPin}
            onSave={onSave}
            onForward={onForward}
          />
        </div>
      ))}
      <div style={{ height: bottomSpace }} aria-hidden="true" />
    </section>
  );
}

export function ReplyComposer({ message, onCancel }) {
  if (!message) return null;
  return (
    <div className="composer-reply">
      <MessageSquareReply />
      <div><b>Replying to {message.sender?.displayName || message.sender?.username || 'message'}</b><span>{message.body || message.fileName || 'Attachment'}</span></div>
      <button onClick={onCancel}><X /></button>
    </div>
  );
}

function urlFromMessage(message) {
  if (message.fileUrl) return assetUrl(message.fileUrl);
  const match = String(message.body || '').match(/https?:\/\/\S+/i);
  return match?.[0] || null;
}

export function MediaGallery({ chat, onClose, messages = [] }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [tab, setTab] = useState('media');

  async function load(reset = false) {
    if (loading || (!hasMore && !reset)) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: '30' });
      const nextCursor = reset ? null : cursor;
      if (nextCursor) query.set('before', nextCursor);
      const data = await fetch(`${apiOrigin}/api/v2/chats/${chat.id}/media?${query}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('verdant-token')}` },
      }).then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Media could not be loaded');
        return body;
      });
      setItems((current) => reset ? data.items : [...current, ...data.items]);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(true); }, [chat.id]);

  const files = useMemo(() => messages.filter((message) => message.fileUrl && !message.mimeType?.startsWith('image/') && !message.mimeType?.startsWith('video/') && !message.mimeType?.startsWith('audio/')), [messages]);
  const voices = useMemo(() => messages.filter((message) => message.mimeType?.startsWith('audio/') || message.type === 'voice'), [messages]);
  const links = useMemo(() => messages.filter((message) => /https?:\/\/\S+/i.test(String(message.body || ''))), [messages]);
  const selectedList = tab === 'media' ? items : tab === 'files' ? files : tab === 'voice' ? voices : links;
  const selected = lightboxIndex === null ? null : selectedList[lightboxIndex];
  const selectedUrl = assetUrl(selected?.fileUrl || urlFromMessage(selected));

  return (
    <div className="media-gallery-overlay" role="dialog" aria-modal="true">
      <section className="media-gallery-panel">
        <header><div><ImageIcon /><span><b>Files</b><small>{chat.title}</small></span></div><button onClick={onClose}><X /></button></header>
        <div className="file-tabs">
          {['media', 'files', 'links', 'voice'].map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setLightboxIndex(null); }}>{item}</button>)}
        </div>
        {tab === 'media' ? (
          <div className="media-gallery-grid">
            {items.map((item, index) => {
              const url = assetUrl(item.fileUrl);
              return <button key={item.id} onClick={() => setLightboxIndex(index)}>{item.mimeType?.startsWith('video/') ? <video src={url} preload="metadata" /> : <img src={url} alt={item.fileName || 'Media'} loading="lazy" />}</button>;
            })}
          </div>
        ) : (
          <div className="file-list-tab">
            {selectedList.map((item, index) => {
              const url = urlFromMessage(item);
              return <a key={item.id || index} href={url || '#'} target={tab === 'links' ? '_blank' : undefined} rel="noreferrer" download={tab !== 'links' ? item.fileName || undefined : undefined}><FileText /><span><b>{item.fileName || item.body || 'Item'}</b><small>{formatTime(item.createdAt)}</small></span></a>;
            })}
            {!selectedList.length && <p className="empty-tab">No {tab} yet.</p>}
          </div>
        )}
        {tab === 'media' && hasMore && <button className="gallery-more" disabled={loading} onClick={() => load()}>{loading ? <Loader2 className="spin" /> : null}Load more</button>}
      </section>

      {selected && selectedUrl && tab === 'media' && (
        <div className="lightbox">
          <button className="lightbox-close" onClick={() => setLightboxIndex(null)}><X /></button>
          <button className="lightbox-prev" disabled={lightboxIndex <= 0} onClick={() => setLightboxIndex((value) => value - 1)}><ChevronLeft /></button>
          {selected.mimeType?.startsWith('video/') ? <video src={selectedUrl} controls autoPlay /> : <img src={selectedUrl} alt={selected.fileName || 'Media'} />}
          <button className="lightbox-next" disabled={lightboxIndex >= selectedList.length - 1} onClick={() => setLightboxIndex((value) => value + 1)}><ChevronRight /></button>
          <a href={selectedUrl} download={selected.fileName || undefined}><Download />Download</a>
        </div>
      )}
    </div>
  );
}
