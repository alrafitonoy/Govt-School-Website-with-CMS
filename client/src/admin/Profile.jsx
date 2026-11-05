import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { Alert } from '../lib/ui.jsx';
import { PageHead, useToast } from './widgets.jsx';
import { useAdmin } from './AdminApp.jsx';

export default function Profile() {
  const { user } = useAdmin();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const toast = useToast();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (form.next !== form.confirm) return setError('The two new passwords do not match.');
    setError('');
    try {
      await api.post('/auth/change-password', form);
      setForm({ current: '', next: '', confirm: '' });
      toast('Password changed. Other devices have been signed out.');
    } catch (err) {
      setError(err.message);
    }
    return undefined;
  };
  return (
    <>
      <PageHead title="My Profile" intro={`${user.name}, ${user.email}`} />
      <form className="box stack" style={{ maxWidth: 480 }} onSubmit={submit}>
        <h2>Change password</h2>
        <div className="field"><label htmlFor="p-c">Current password</label><input id="p-c" type="password" autoComplete="current-password" required value={form.current} onChange={set('current')} /></div>
        <div className="field"><label htmlFor="p-n">New password</label><input id="p-n" type="password" autoComplete="new-password" required value={form.next} onChange={set('next')} /></div>
        <div className="field"><label htmlFor="p-r">Repeat the new password</label><input id="p-r" type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} /></div>
        {error && <Alert>{error}</Alert>}
        <p><button className="btn btn-primary">Change password</button></p>
      </form>
    </>
  );
}
