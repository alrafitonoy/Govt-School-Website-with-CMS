import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, formatDateTime } from '../lib/api.js';
import { Alert, Spinner, useLoad } from '../lib/ui.jsx';
import { ConfirmDelete, Modal, PageHead, Switch, useAction } from './widgets.jsx';
import { useAdmin } from './AdminApp.jsx';

function ActivationNotice({ info, onClose }) {
  return (
    <Modal title={info.emailed ? 'Verification email sent' : 'Email could not be sent'} onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}>
      {info.emailed ? <Alert kind="success">The person will receive an email with a link to verify the address and set a password.</Alert> : (
        <div className="stack">
          <Alert kind="warn">{info.reason} Send this private link to the person yourself. It expires in 72 hours and lets them set the password, so share it only with them.</Alert>
          <div className="code-box">{info.link}</div>
        </div>
      )}
    </Modal>
  );
}

function UserEditor({ user, permissions, onClose, onSaved }) {
  const [u, setU] = useState(user);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (u.id) {
        const r = await api.put(`/admin/users/${u.id}`, u);
        onSaved(r.activation);
      } else {
        onSaved(await api.post('/admin/users', u));
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  const groups = {};
  for (const p of permissions) (groups[p.moduleTitle] ||= []).push(p);
  const toggle = (key, on) => setU({ ...u, permissions: on ? [...u.permissions, key] : u.permissions.filter((x) => x !== key) });
  return (
    <Modal wide title={u.id ? `Edit ${user.name}` : 'Add a user'} onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : u.id ? 'Save' : 'Create and send email'}</button></>}>
      <div className="stack">
        {error && <Alert>{error}</Alert>}
        <div className="grid-2">
          <div className="field"><label htmlFor="u-n">Name</label><input id="u-n" value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="u-e">Email</label><input id="u-e" type="email" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} />{u.id && <span className="help">Changing this signs the person out until the new address is verified.</span>}</div>
          <div className="field"><label htmlFor="u-r">Role</label><select id="u-r" value={u.role} onChange={(e) => setU({ ...u, role: e.target.value })}><option value="staff">School staff</option><option value="admin">Administrator</option></select></div>
          {u.id && <div className="field"><span className="field-label">Account</span><Switch checked={u.active} onChange={(active) => setU({ ...u, active })} label="Active" /></div>}
        </div>
        {u.role === 'admin' ? <Alert kind="info">Administrators can do everything, including managing users and modules.</Alert> : (
          <div>
            <h3 style={{ fontSize: '.98rem', marginBottom: 10 }}>Permissions</h3>
            <div className="stack">
              {Object.entries(groups).map(([title, list]) => (
                <div key={title}>
                  <p style={{ fontWeight: 700, fontSize: '.84rem', color: 'var(--muted)', marginBottom: 6 }}>{title}</p>
                  <div className="perm-grid">
                    {list.map((p) => <label className="check" key={p.key}><input type="checkbox" checked={u.permissions.includes(p.key)} onChange={(e) => toggle(p.key, e.target.checked)} /> {p.label}</label>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAdmin();
  const { data, loading, error, reload } = useLoad('/admin/users');
  const [editing, setEditing] = useState(null);
  const [activation, setActivation] = useState(null);
  const run = useAction();
  if (loading && !data) return <Spinner />;
  if (error) return <Alert>{error.message}</Alert>;
  return (
    <>
      <PageHead title="User Accounts" intro="New users verify their email address and choose their own password.">
        <button className="btn btn-primary" onClick={() => setEditing({ name: '', email: '', role: 'staff', permissions: [], active: true })}><Plus size={16} /> Add user</button>
      </PageHead>
      <div className="scroll">
        <table className="ad-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign in</th><th /></tr></thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td><td>{u.email}</td>
                <td><span className={`badge ${u.role === 'admin' ? 'badge-brand' : ''}`} style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                <td>{!u.active ? <span className="badge">Inactive</span> : u.verified ? <span className="badge badge-good">Verified</span> : <span className="badge badge-warn">Not verified</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{u.last_login_at ? formatDateTime(u.last_login_at) : '-'}</td>
                <td className="actions">
                  {!u.verified && <button className="btn btn-ghost btn-sm" onClick={() => run(async () => setActivation(await api.post(`/admin/users/${u.id}/resend`)))}>Resend</button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>Edit</button>
                  {u.id !== me.id && <ConfirmDelete message={`Delete ${u.name}'s account?`} onConfirm={() => run(async () => { await api.del(`/admin/users/${u.id}`); reload(); }, 'Deleted')} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <UserEditor
          user={editing}
          permissions={data.permissions}
          onClose={() => setEditing(null)}
          onSaved={(info) => {
            setEditing(null);
            reload();
            if (info) setActivation(info);
          }}
        />
      )}
      {activation && <ActivationNotice info={activation} onClose={() => setActivation(null)} />}
    </>
  );
}
