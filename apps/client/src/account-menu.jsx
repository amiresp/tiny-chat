import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  CircleUserRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { enableNotifications, notificationState, refreshPwa } from './app-tools';

export function AccountMenu({ user, onClose, onProfile, onAdmin, onLogout }) {
  const [permission, setPermission] = useState(notificationState());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function activateNotifications() {
    try {
      setBusy(true);
      setError('');
      const result = await enableNotifications();
      setPermission(result);
    } catch (requestError) {
      setPermission(notificationState());
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateApplication() {
    try {
      setBusy(true);
      setError('');
      await refreshPwa();
    } catch (requestError) {
      setBusy(false);
      setError(requestError.message || 'Application update failed.');
    }
  }

  return (
    <div className="account-menu-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="account-menu-sheet" role="dialog" aria-modal="true">
        <header>
          <div>
            <strong>{user?.displayName || user?.username || 'Account'}</strong>
            <small>@{user?.username || 'user'}</small>
          </div>
          <button title="Close" onClick={onClose}><X /></button>
        </header>

        <div className="account-menu-actions">
          <button onClick={() => { onClose(); onProfile(); }}>
            <CircleUserRound />
            <span><b>Profile</b><small>Account, privacy and password</small></span>
          </button>

          {user?.role === 'admin' && (
            <button onClick={() => { onClose(); onAdmin(); }}>
              <ShieldCheck />
              <span><b>Administration</b><small>Users, chats and online sessions</small></span>
            </button>
          )}

          <button disabled={busy || permission === 'granted'} onClick={activateNotifications}>
            {permission === 'granted' ? <Bell /> : <BellOff />}
            <span>
              <b>{permission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}</b>
              <small>{permission === 'granted' ? 'New messages can notify this device' : 'Allow alerts for incoming messages'}</small>
            </span>
          </button>

          <button disabled={busy} onClick={updateApplication}>
            <RefreshCw className={busy ? 'spin' : ''} />
            <span><b>Update application</b><small>Clear cache and load the newest version</small></span>
          </button>
        </div>

        {error && <p className="account-menu-error">{error}</p>}

        <button className="account-menu-logout" onClick={onLogout}>
          <LogOut /> Sign out
        </button>
      </section>
    </div>
  );
}
