import React from 'react';
import { CircleUserRound } from 'lucide-react';
import { apiOrigin } from './runtime';
import './sidebar-extra.css';

function resolveImage(value) {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return value.startsWith('/') ? `${apiOrigin}${value}` : value;
}

export function SidebarAccount({ user, onOpen }) {
  const source = resolveImage(user?.avatarUrl);
  const label = user?.displayName || user?.username || 'Profile';

  return (
    <button className="sidebar-profile-button" title="Account menu" onClick={onOpen}>
      {source ? <img src={source} alt={label} /> : <CircleUserRound />}
    </button>
  );
}
