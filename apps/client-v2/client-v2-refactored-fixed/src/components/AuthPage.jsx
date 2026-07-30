import React, { useState } from 'react';
import { IonButton, IonContent, IonInput, IonLoading, IonPage, IonToast } from '@ionic/react';
import { api, setToken } from '../api';

export function AuthPage({ onDone, themeMode = 'system', onThemeModeChange }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', mobile: '', identity: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    try {
      setBusy(true);
      const data = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      setToken(data.token);
      onDone(data.user);
    } catch (error) {
      setToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <IonPage>
      <IonContent fullscreen className="auth-page">
        <form className="auth-card" onSubmit={submit}>
          <img src="/icon.svg" alt="Tiny Chat" />
          <h1>Tiny Chat</h1>
          <p>Small, fast and focused real-time messaging.</p>
          <div className="tiny-auth-theme" role="group" aria-label="Theme">{['light','dark','system'].map((value) => <button type="button" key={value} className={themeMode === value ? 'active' : ''} onClick={() => onThemeModeChange?.(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
          {mode === 'register' && <>
            <IonInput label="Username" labelPlacement="stacked" value={form.username} onIonInput={(event) => setForm((current) => ({ ...current, username: event.detail.value || '' }))} />
            <IonInput label="Mobile" labelPlacement="stacked" value={form.mobile} onIonInput={(event) => setForm((current) => ({ ...current, mobile: event.detail.value || '' }))} />
          </>}
          {mode === 'login' && <IonInput label="Username or mobile" labelPlacement="stacked" value={form.identity} onIonInput={(event) => setForm((current) => ({ ...current, identity: event.detail.value || '' }))} />}
          <IonInput label="Password" labelPlacement="stacked" type="password" value={form.password} onIonInput={(event) => setForm((current) => ({ ...current, password: event.detail.value || '' }))} />
          <IonButton expand="block" type="submit" disabled={busy}>{mode === 'login' ? 'Sign in' : 'Create account'}</IonButton>
          <IonButton fill="clear" type="button" onClick={() => setMode((current) => current === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create account' : 'Back to sign in'}</IonButton>
        </form>
      </IonContent>
      <IonLoading isOpen={busy} message="Please wait…" />
      <IonToast isOpen={Boolean(toast)} message={toast} duration={2600} onDidDismiss={() => setToast('')} />
    </IonPage>
  );
}
