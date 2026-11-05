import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { api, formatDateTime } from '../lib/api.js';
import { Alert, Pagination, Spinner, useLoad } from '../lib/ui.jsx';
import { ConfirmDelete, Modal, PageHead, RichEditor, useAction, useToast } from './widgets.jsx';
import { useAdmin } from './AdminApp.jsx';

const PLACEHOLDERS = 'You can use {{school_name}} and {{name}}. Messages to applicants can also use {{student_name}} and {{app_no}}.';

function Compose({ templates, ready }) {
  const blank = { template: '', subject: '', body: '', groups: [], applicant_status: '', emails: '' };
  const [m, setM] = useState(blank);
  const [editorKey, setEditorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const toast = useToast();

  const useTemplate = (id) => {
    const t = templates.find((x) => String(x.id) === id);
    setM({ ...m, template: t?.tkey || '', subject: t?.subject || m.subject, body: t?.body || m.body });
    setEditorKey((k) => k + 1);
  };
  const toggleGroup = (g, on) => setM({ ...m, groups: on ? [...m.groups, g] : m.groups.filter((x) => x !== g) });

  const send = async () => {
    setBusy(true);
    setNotice('');
    try {
      const r = await api.post('/admin/email/send', m);
      setNotice(`Sending to ${r.queued} recipient(s). Results will appear in the Sent log.`);
      setM(blank);
      setEditorKey((k) => k + 1);
    } catch (err) {
      toast(err.message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="box stack">
      {!ready && <Alert kind="warn">Email is not set up yet. Add your SMTP details in the email settings first.</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <div className="field"><label htmlFor="c-t">Start from a template</label>
        <select id="c-t" defaultValue="" onChange={(e) => useTemplate(e.target.value)}><option value="">None</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>
      <div className="field"><span className="field-label">Send to</span>
        <label className="check"><input type="checkbox" checked={m.groups.includes('staff')} onChange={(e) => toggleGroup('staff', e.target.checked)} /> All staff</label>
        <label className="check"><input type="checkbox" checked={m.groups.includes('applicants')} onChange={(e) => toggleGroup('applicants', e.target.checked)} /> Admission applicants</label>
        {m.groups.includes('applicants') && (
          <select aria-label="Applicant status" value={m.applicant_status} onChange={(e) => setM({ ...m, applicant_status: e.target.value })}>
            <option value="">Any status</option>
            {['submitted', 'reviewing', 'accepted', 'waitlisted', 'rejected'].map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
      </div>
      <div className="field"><label htmlFor="c-e">Other email addresses</label><textarea id="c-e" rows={2} placeholder="Separate with commas" value={m.emails} onChange={(e) => setM({ ...m, emails: e.target.value })} /></div>
      <div className="field"><label htmlFor="c-s">Subject</label><input id="c-s" value={m.subject} onChange={(e) => setM({ ...m, subject: e.target.value })} /></div>
      <div className="field"><span className="field-label">Message</span><RichEditor key={editorKey} value={m.body} onChange={(body) => setM({ ...m, body })} /><span className="help">{PLACEHOLDERS} The school logo, name and contact details are added automatically.</span></div>
      <p><button className="btn btn-primary" disabled={busy || !ready} onClick={send}>{busy ? 'Sending...' : 'Send email'}</button></p>
    </div>
  );
}

function Templates({ templates, reload }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const run = useAction();
  const save = async () => {
    setError('');
    try {
      if (editing.id) await api.put(`/admin/email/templates/${editing.id}`, editing);
      else await api.post('/admin/email/templates', editing);
      setEditing(null);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <>
      <p style={{ marginBottom: 14 }}><button className="btn btn-primary" onClick={() => setEditing({ name: '', subject: '', body: '<p>Dear {{name}},</p><p></p>' })}>New template</button></p>
      <div className="scroll">
        <table className="ad-table">
          <thead><tr><th>Template</th><th>Subject</th><th>Type</th><th /></tr></thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td><td>{t.subject}</td><td><span className="badge">{t.is_system ? 'Built-in' : 'Custom'}</span></td>
                <td className="actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setError(''); setEditing(t); }}>Edit</button>
                  {!t.is_system && <ConfirmDelete onConfirm={() => run(async () => { await api.del(`/admin/email/templates/${t.id}`); reload(); }, 'Deleted')} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal wide title={editing.id ? 'Edit template' : 'New template'} onClose={() => setEditing(null)} footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
          <div className="stack">
            {error && <Alert>{error}</Alert>}
            <div className="field"><label htmlFor="t-n">Template name</label><input id="t-n" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="t-s">Subject</label><input id="t-s" value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></div>
            <div className="field"><span className="field-label">Message</span><RichEditor value={editing.body} onChange={(body) => setEditing({ ...editing, body })} />
              <span className="help">Keep placeholders such as {'{{link}}'} and {'{{name}}'} in built-in templates, because they are filled in when the email is sent.</span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function Log() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useLoad(`/admin/email/log?page=${page}`);
  if (loading && !data) return <Spinner />;
  if (error) return <Alert>{error.message}</Alert>;
  if (!data.items.length) return <div className="box empty">No emails sent yet.</div>;
  return (
    <>
      <div className="scroll">
        <table className="ad-table">
          <thead><tr><th>To</th><th>Subject</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {data.items.map((l) => (
              <tr key={l.id}>
                <td>{l.to_addr}</td><td>{l.subject}</td>
                <td><span className={`badge ${l.status === 'sent' ? 'badge-good' : 'badge-bad'}`} title={l.error || ''}>{l.status}</span>{l.error && <div className="help">{l.error}</div>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
    </>
  );
}

export default function EmailAdmin() {
  const { user } = useAdmin();
  const [tab, setTab] = useState('compose');
  const { data, loading, error, reload } = useLoad('/admin/email/templates');
  const run = useAction();
  const test = () => {
    const to = window.prompt('Send a test email to:', user.email);
    if (to) run(() => api.post('/admin/email/test', { to }), 'Test email sent');
  };
  if (loading && !data) return <Spinner />;
  if (error) return <Alert>{error.message}</Alert>;
  return (
    <>
      <PageHead title="Email" intro="Send messages using the school's standard template, and edit the automatic emails.">
        <button className="btn btn-ghost" onClick={test}>Send test</button>
        {user.role === 'admin' && <Link className="btn btn-ghost" to="/modules/email"><Settings size={15} /> SMTP settings</Link>}
      </PageHead>
      <div className="tabs" role="tablist">
        {[['compose', 'Compose'], ['templates', 'Templates'], ['log', 'Sent log']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'compose' && <Compose templates={data.items} ready={data.ready} />}
      {tab === 'templates' && <Templates templates={data.items} reload={reload} />}
      {tab === 'log' && <Log />}
    </>
  );
}
