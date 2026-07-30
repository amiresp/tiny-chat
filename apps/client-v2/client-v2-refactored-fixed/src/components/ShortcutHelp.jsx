import React from 'react';
import { X } from 'lucide-react';
export function ShortcutHelp({ open, onClose }) {
  if (!open) return null;
  return <div className="desktop-shortcuts-layer" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="desktop-shortcuts-card"><header><strong>Keyboard shortcuts</strong><button type="button" onClick={onClose}><X size={16} /></button></header><dl><div><dt>Ctrl / Cmd + K</dt><dd>Search chats</dd></div><div><dt>Ctrl / Cmd + N</dt><dd>New chat</dd></div><div><dt>Ctrl / Cmd + /</dt><dd>Shortcut help</dd></div><div><dt>Esc</dt><dd>Close dialogs</dd></div><div><dt>Shift + Enter</dt><dd>New line</dd></div><div><dt>Enter</dt><dd>Send message</dd></div></dl></section></div>;
}
