import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSite } from '../lib/site.jsx';
import { Alert } from '../lib/ui.jsx';

function Shell({ title, intro, children }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
        {children}
      </div>
    </div>
  );
}

const PasswordHelp = () => <span className="help">At least 10 characters, with letters and numbers.</span>;

export function Login({ onLogin }) {
  const { site } = useSite();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/login', form);
      await onLogin();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Shell title="Sign in" intro={site.school_name}>
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        {error && <Alert>{error}</Alert>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
      <p className="auth-links"><a href="/signin/forgot">Forgot password?</a> · <a href="/">Back to site</a></p>
    </Shell>
  );
}

export function Setup({ keyConfigured, onDone }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', setup_key: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/setup', form);
      await api.post('/auth/login', { email: form.email, password: form.password });
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  if (!keyConfigured) {
    return <Shell title="Welcome" intro="One step before setup."><Alert kind="warn">Add a SETUP_KEY value to the server's environment settings, restart the app, then reload this page.</Alert></Shell>;
  }
  return (
    <Shell title="Create the admin account" intro="This first account controls the whole site.">
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="sk">Setup key</label><input id="sk" type="password" required value={form.setup_key} onChange={set('setup_key')} /><span className="help">The SETUP_KEY value from the server's environment settings.</span></div>
        <div className="field"><label htmlFor="n">Your name</label><input id="n" required value={form.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" autoComplete="username" required value={form.email} onChange={set('email')} /></div>
        <div className="field"><label htmlFor="p">Password</label><input id="p" type="password" autoComplete="new-password" required value={form.password} onChange={set('password')} /><PasswordHelp /></div>
        {error && <Alert>{error}</Alert>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
      </form>
    </Shell>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/forgot', { email });
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Shell title="Reset your password" intro="We will email you a link to choose a new password.">
      {sent ? <Alert kind="success">If that address has an account, a reset link is on its way. It expires in 1 hour.</Alert> : (
        <form onSubmit={submit}>
          <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {error && <Alert>{error}</Alert>}
          <button className="btn btn-primary">Send reset link</button>
        </form>
      )}
      <p className="auth-links"><a href="/signin">Back to sign in</a></p>
    </Shell>
  );
}

// Used for both account activation (which verifies the email) and password reset.
export function TokenPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [info, setInfo] = useState(null);
  const [invalid, setInvalid] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.post('/auth/token-info', { token }).then(setInfo).catch((e) => setInvalid(e.message));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError('The two passwords do not match.');
    setError('');
    try {
      await api.post('/auth/redeem', { token, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
    return undefined;
  };

  if (invalid) return <Shell title="Link not valid"><Alert>{invalid}</Alert><p className="auth-links"><a href="/signin/forgot">Request a new link</a></p></Shell>;
  if (!info) return <Shell title="Checking link..." />;
  if (done) {
    return (
      <Shell title={info.kind === 'activate' ? 'Email verified' : 'Password changed'}>
        <Alert kind="success">{info.kind === 'activate' ? 'Your account is ready.' : 'You can now sign in with the new password.'}</Alert>
        <p className="auth-links"><a className="btn btn-primary" href="/signin">Go to sign in</a></p>
      </Shell>
    );
  }
  return (
    <Shell title={info.kind === 'activate' ? 'Activate your account' : 'Choose a new password'} intro={info.email}>
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="p">New password</label><input id="p" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /><PasswordHelp /></div>
        <div className="field"><label htmlFor="c">Repeat the password</label><input id="c" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        {error && <Alert>{error}</Alert>}
        <button className="btn btn-primary">Save password</button>
      </form>
    </Shell>
  );
}
