import React, { memo, useRef } from 'react';
import { FileText, Reply } from 'lucide-react';
import { assetUrl, getToken } from '../api';
import { formatTime } from '../lib/chat';
import { MessageStatus } from './MessageStatus';
import { AudioMessage } from './AudioMessage';


async function downloadFile(event, message, url) {
  event.preventDefault();
  event.stopPropagation();
  try {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = message.fileName || 'download';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function shouldIgnoreAction(target) {
  return Boolean(target.closest('audio,video,a,button,input'));
}

export const MessageBubble = memo(function MessageBubble({ message, me, onAction, onSwipeReply, onOpenMedia }) {
  const mine = Number(message.senderId) === Number(me.id);
  const url = assetUrl(message.fileUrl);
  const isImage = message.mimeType?.startsWith('image/');
  const isVideo = message.mimeType?.startsWith('video/');
  const isAudio = message.mimeType?.startsWith('audio/') || message.type === 'voice';
  const touch = useRef(null);

  function touchStart(event) {
    const item = event.touches?.[0];
    if (!item || message.deletedAt) return;
    touch.current = { x: item.clientX, y: item.clientY };
  }

  function touchEnd(event) {
    if (!touch.current) return;
    const item = event.changedTouches?.[0];
    const dx = item.clientX - touch.current.x;
    const dy = Math.abs(item.clientY - touch.current.y);
    touch.current = null;
    if (dx > 62 && dy < 56 && !message.deletedAt) {
      navigator.vibrate?.(6);
      onSwipeReply(message);
    }
  }

  function openActions(event) {
    if (shouldIgnoreAction(event.target)) return;
    onAction(message);
  }

  return (
    <div className={`message-line ${mine ? 'mine' : ''}`} onTouchStart={touchStart} onTouchEnd={touchEnd}>
      <article className={`message-bubble ${mine ? 'mine' : ''}`} tabIndex={0} onClick={openActions} onContextMenu={(event) => { event.preventDefault(); onAction(message); }}>
        {message.forwardedFromId && <small className="forwarded">Forwarded</small>}
        {message.replyTo && <span className="reply-chip"><Reply size={12} /> {message.replyTo.body || 'Attachment'}</span>}
        {message.deletedAt ? <em>Message deleted</em> : <>
          {message.body && <span className="message-text">{message.body}</span>}
          {isImage && url && <button type="button" className="media-button" onClick={() => onOpenMedia?.(message)}><img className="message-media" src={url} alt={message.fileName || 'image'} loading="lazy" /></button>}
          {isVideo && url && <div className="video-media-wrap"><video className="message-media" src={url} controls preload="metadata" /><button type="button" className="media-open-button" onClick={() => onOpenMedia?.(message)}>Open</button></div>}
          {isAudio && url && <AudioMessage src={url} label={message.type === 'voice' ? 'Voice message' : 'Audio file'} />}
          {url && !isImage && !isVideo && !isAudio && <a className="file-chip" href={url} target="_blank" rel="noreferrer" download={message.fileName || undefined} onClick={(event) => downloadFile(event, message, url)}><FileText size={16} />{message.fileName || 'File'}</a>}
        </>}
        <time>{formatTime(message.createdAt)}{message.editedAt ? ' · edited' : ''}<MessageStatus message={message} mine={mine} /></time>
      </article>
    </div>
  );
}, (previous, next) => previous.message === next.message && previous.me?.id === next.me?.id);
