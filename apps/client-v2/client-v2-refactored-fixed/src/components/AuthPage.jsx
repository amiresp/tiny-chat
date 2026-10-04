import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, LogIn, MessageSquare, Phone, ShieldCheck, UserRound, UserPlus, Zap } from 'lucide-react';
import { api, setToken } from '../api';

export function AuthPage({ onDone }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', mobile: '', identity: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const strength = useMemo(() => {
    const value = form.password;
    if (!value) return { score: 0, label: 'Password strength' };
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    return { score, label: score <= 1 ? 'Weak' : score < 4 ? 'Medium' : 'Strong' };
  }, [form.password]);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (mode === 'register') {
      if (!form.username.trim() || !form.mobile.trim()) return setError('Username and mobile number are required.');
      if (form.password.length < 8) return setError('Password must be at least 8 characters.');
      if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    } else if (!form.identity.trim() || !form.password) {
      return setError('Username or mobile number and password are required.');
    }
    try {
      setBusy(true);
      const payload = mode === 'login'
        ? { identity: form.identity.trim(), password: form.password }
        : { username: form.username.trim(), mobile: form.mobile.trim(), password: form.password };
      const data = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(payload) });
      setToken(data.token);
      onDone(data.user);
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  return <div className="tc-auth-page">
    <div className="tc-auth-container">
      <section className="tc-auth-brand">
        <div className="tc-auth-logo">
          <span className="tc-auth-logo-icon"><MessageSquare size={27} fill="currentColor" /></span>
          <span><strong>Tiny Chat</strong><small>Fast, focused messaging</small></span>
        </div>
        <div className="tc-auth-brand-content">
          <h1>Welcome to <span>simple, fast</span><br />real-time messaging</h1>
          <p>Stay connected with the people who matter. Tiny Chat keeps conversations focused, responsive and easy to use across your devices.</p>
          <div className="tc-auth-features">
            <span><ShieldCheck size={18} /> Secure account access</span>
            <span><Zap size={18} /> Fast real-time conversations</span>
            <span><MessageSquare size={18} /> Clean and focused messaging</span>
          </div>
        </div>
        <div className="tc-auth-footer"><span>Tiny Chat</span><span>Private by design</span></div>
      </section>

      <section className="tc-auth-form-panel">
        <div className="tc-auth-header">
          <h2>{mode === 'login' ? 'Welcome back 👋' : 'Create your account ✨'}</h2>
          <p>{mode === 'login' ? 'Sign in to continue to Tiny Chat.' : 'It only takes a few seconds.'}</p>
        </div>
        <div className="tc-auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Sign in</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Register</button>
        </div>

        <form className="tc-auth-form" onSubmit={submit}>
          {error && <div className="tc-auth-error">{error}</div>}

          {mode === 'register' && <>
            <label className="tc-auth-group"><span><UserRound size={15}/> Username</span><div className="tc-auth-input"><UserRound size={18}/><input value={form.username} onChange={update('username')} autoComplete="username" placeholder="your_username" /></div></label>
            <label className="tc-auth-group"><span><Phone size={15}/> Mobile number</span><div className="tc-auth-input"><Phone size={18}/><input value={form.mobile} onChange={update('mobile')} autoComplete="tel" inputMode="tel" placeholder="09150099912" /></div></label>
          </>}

          {mode === 'login' && <label className="tc-auth-group"><span><UserRound size={15}/> Username or mobile</span><div className="tc-auth-input"><UserRound size={18}/><input value={form.identity} onChange={update('identity')} autoComplete="username" placeholder="Username or mobile number" /></div></label>}

          <label className="tc-auth-group"><span><LockKeyhole size={15}/> Password</span><div className="tc-auth-input"><LockKeyhole size={18}/><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={update('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'} /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>

          {mode === 'register' && <>
            <div className={`tc-strength s${strength.score}`}><i/><i/><i/></div><small className="tc-strength-text">{strength.label}</small>
            <label className="tc-auth-group"><span><LockKeyhole size={15}/> Confirm password</span><div className="tc-auth-input"><LockKeyhole size={18}/><input type={showConfirm ? 'text' : 'password'} value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" placeholder="Repeat password" /><button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label="Toggle password visibility">{showConfirm ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
          </>}

          <button className="tc-auth-submit" disabled={busy} type="submit">{busy ? <span className="tc-auth-spinner"/> : mode === 'login' ? <LogIn size={18}/> : <UserPlus size={18}/>}<span>{busy ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign in to Tiny Chat' : 'Create account')}</span></button>
          <div className="tc-auth-switch">{mode === 'login' ? <>Don't have an account? <button type="button" onClick={() => switchMode('register')}>Register</button></> : <>Already have an account? <button type="button" onClick={() => switchMode('login')}>Sign in</button></>}</div>
        </form>
      </section>
    </div>
  </div>;
}
