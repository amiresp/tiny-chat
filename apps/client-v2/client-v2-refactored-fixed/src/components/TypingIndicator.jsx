import React, { memo } from 'react';

export const TypingIndicator = memo(function TypingIndicator({ users }) {
  if (!users.length) return null;
  const names = users.slice(0, 2).map((item) => item.displayName || item.username || 'Someone');
  const text = users.length > 2
    ? `${names.join(', ')} and ${users.length - 2} more are typing…`
    : `${names.join(' and ')} ${users.length === 1 ? 'is' : 'are'} typing…`;
  return <div className="typing-indicator"><span /><span /><span /><b>{text}</b></div>;
});
