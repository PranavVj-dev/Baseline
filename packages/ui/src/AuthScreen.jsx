import { useState } from 'react';
import { useAuth } from './auth.jsx';

const CHOICES = {
  staff: { title: 'Coach or trainer', text: 'I run a team, record matches or track training.' },
  viewer: { title: 'Player, parent or follower', text: 'I want to follow matches and see progress.' },
};

export default function AuthScreen({ appName, tagline, roles, onGuest }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: roles.length === 1 ? roles[0] : '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await signup(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-brand">
        <h1>{appName}</h1>
        <p>{tagline}</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>

        {mode === 'signup' && (
          <label className="field">Full name
            <input value={form.name} onChange={set('name')} autoComplete="name" required />
          </label>
        )}
        <label className="field">Email
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </label>
        <label className="field">Password
          <input type="password" value={form.password} onChange={set('password')} minLength={mode === 'signup' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
        </label>

        {mode === 'signup' && roles.length > 1 && (
          <fieldset className="choices">
            <legend>How will you use Baseline?</legend>
            {roles.map((r) => (
              <button type="button" key={r} className="choice" aria-pressed={form.role === r} onClick={() => setForm({ ...form, role: r })}>
                <strong>{CHOICES[r].title}</strong>
                <span>{CHOICES[r].text}</span>
              </button>
            ))}
          </fieldset>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy || (mode === 'signup' && !form.role)}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
        {onGuest && <button type="button" className="btn btn-quiet" onClick={onGuest}>Browse matches without an account</button>}
      </form>
    </div>
  );
}
