import React from 'react';
import { MessageCircleMore, Plus, UserRound } from 'lucide-react';

export function MobileNav({ unreadCount, showFab, onChats, onProfile, onNewChat }) {
  return (
    <>
      <button
        className={`mobile-new-chat-fab ${showFab ? 'visible' : ''}`}
        onClick={onNewChat}
        aria-label="New conversation"
      >
        <Plus />
      </button>
      <nav className="mobile-bottom-navigation">
        <button className="active" onClick={onChats}>
          <span className="mobile-nav-icon">
            <MessageCircleMore />
            {unreadCount > 0 && <em>{unreadCount > 99 ? '99+' : unreadCount}</em>}
          </span>
          <span>Chats</span>
        </button>
        <button onClick={onProfile}>
          <UserRound />
          <span>Profile</span>
        </button>
      </nav>
    </>
  );
}
