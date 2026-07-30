import React, { memo } from 'react';
import { Check, CheckCheck, CircleAlert } from 'lucide-react';

function statusOf(message) {
  if (message.failedAt || message.status === 'failed') return ['failed', 'failed', CircleAlert];
  if (message.readAt) return ['seen', 'seen', CheckCheck];
  if (message.deliveredAt) return ['delivered', 'delivered', CheckCheck];
  if (message.status === 'queued') return ['queued', 'queued', Check];
  return ['sent', 'sent', Check];
}

export const MessageStatus = memo(function MessageStatus({ message, mine }) {
  if (!mine) return null;
  const [key, label, Icon] = statusOf(message);
  return <span className={`message-status ${key}`} title={label}><Icon size={13} />{label}</span>;
});
