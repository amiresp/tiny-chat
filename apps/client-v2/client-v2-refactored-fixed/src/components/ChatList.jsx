import React, { memo, useMemo } from 'react';
import { Menu, Search } from 'lucide-react';
import { Avatar } from './Avatar';

function formatChatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (now.getTime() - date.getTime() < 7 * 86400000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function preview(chat) {
  const body = String(chat.lastMessageBody || chat.lastMessage?.body || '').trim().replace(/\s+/g, ' ');
  if (body) return body;
  if (chat.lastMessage?.fileName || chat.lastMessageFileName) return chat.lastMessage?.fileName || chat.lastMessageFileName;
  if (chat.type === 'saved') return 'Private saved messages';
  if (chat.type === 'rss') return 'RSS channel';
  if (chat.type === 'group') return 'Group conversation';
  if (chat.peer?.isOnline) return 'online';
  return 'direct message';
}

export const ChatList = memo(function ChatList({
  chats, activeId, query, setQuery, showHidden, onOpen, onSettings,
}) {
  const q = query.trim().toLowerCase();
  const list = useMemo(() => chats.filter((chat) => {
    if (chat.hidden && !showHidden) return false;
    if (!q) return true;
    return String(chat.title || chat.peer?.displayName || chat.peer?.username || '').toLowerCase().includes(q)
      || preview(chat).toLowerCase().includes(q);
  }), [chats, showHidden, q]);

  return <aside className="chat-list-panel">
    <div className="list-header">
      <button type="button" className="menu-btn" onClick={onSettings} aria-label="Menu"><Menu size={21}/></button>
      <div className="search-box"><Search size={16}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search..." /></div>
    </div>
    <div className="chat-list">
      {list.map((chat) => <button type="button" className={`chat-item ${Number(activeId)===Number(chat.id)?'active':''}`} key={chat.id} onClick={()=>onOpen(chat)}>
        <Avatar entity={chat} icon={chat.type==='saved'?'★':chat.type==='group'?'G':chat.type==='rss'?'R':undefined} />
        <div className="chat-item-content">
          <div className="chat-item-top"><span className="chat-item-name">{chat.title || 'Chat'}</span><span className="chat-item-time">{formatChatTime(chat.lastMessageAt || chat.updatedAt)}</span></div>
          <div className="chat-item-bottom"><span className="chat-item-msg">{preview(chat)}</span>{Number(chat.unreadCount||0)>0&&<span className="unread-badge">{chat.unreadCount}</span>}</div>
        </div>
      </button>)}
      {!list.length && <div className="list-empty">No chats</div>}
    </div>
  </aside>;
});
