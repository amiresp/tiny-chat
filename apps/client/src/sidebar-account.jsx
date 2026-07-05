import React from 'react';
import { CircleUserRound, ShieldCheck } from 'lucide-react';
import { apiOrigin } from './runtime';

function resolveImage(value) {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return value.startsWith('/') ? `${apiOrigin}${value}` : value;
}

export function SidebarAccount({ user, onProfile, onAdmin }) {
  const source = resolveImage(user?.avatarUrl);
  const label = user?.displayName || user?.username || 'Profile';

  return (
    <div className="sidebar-account">
      {user?.role === 'admin' && (
        <button className="sidebar-admin-button" title="Administration" onClick={onAdmin}>
          <ShieldCheck />
        </button>
      )}
      <button className="sidebar-profile-button" title="Profile" onClick={onProfile}>
        {source ? <img src={source} alt={label} /> : <CircleUserRound />}
      </button>
    </div>
  );
}
