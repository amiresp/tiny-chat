import React, { useEffect, useMemo } from 'react';
import { FileText, Send, X } from 'lucide-react';

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function AttachmentPreview({ file, onCancel, onSend }) {
  const url = useMemo(() => file && (file.type.startsWith('image/') || file.type.startsWith('video/')) ? URL.createObjectURL(file) : '', [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!file) return null;
  const image = file.type.startsWith('image/');
  const video = file.type.startsWith('video/');
  return <div className="attachment-preview-layer" role="dialog" aria-modal="true" aria-label="Attachment preview" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
    <section className="attachment-preview-card">
      <header><div><b>Send attachment</b><small>Review before uploading</small></div><button type="button" onClick={onCancel} aria-label="Close"><X size={18} /></button></header>
      <div className="attachment-preview-body">
        {image && <img src={url} alt={file.name} />}
        {video && <video src={url} controls preload="metadata" />}
        {!image && !video && <div className="attachment-file-icon"><FileText size={38} /></div>}
        <div className="attachment-file-meta"><b>{file.name}</b><small>{file.type || 'file'} · {formatSize(file.size)}</small></div>
      </div>
      <footer><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button type="button" className="primary" onClick={onSend}><Send size={16} />Send</button></footer>
    </section>
  </div>;
}
