import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Lock, Plus, Settings, Trash2 } from 'lucide-react';
import { api, apiUrl, formatDateTime } from '../lib/api.js';
import { Alert, Pagination, Spinner, useLoad } from '../lib/ui.jsx';
import { ConfirmDelete, Modal, PageHead, Switch, useAction, useToast } from './widgets.jsx';
import { useAdmin } from './AdminApp.jsx';

const STATUSES = ['submitted', 'reviewing', 'accepted', 'waitlisted', 'rejected'];
const statusBadge = { submitted: 'badge-brand', reviewing: 'badge-warn', accepted: 'badge-good', waitlisted: 'badge-warn', rejected: 'badge-bad' };
const payBadge = { paid: 'badge-good', pending: 'badge-warn', unpaid: 'badge-bad', not_required: '' };
const payLabel = { paid: 'Paid', pending: 'To verify', unpaid: 'Unpaid', not_required: 'No fee' };

function ApplicationDetail({ id, onClose, onChanged }) {
  const { data, loading, error } = useLoad(`/admin/admission/applications/${id}`);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const run = useAction();
  useEffect(() => {
    if (data) {
      setStatus(data.status);
      setNotes(data.notes || '');
    }
  }, [data]);
  const save = () => run(async () => {
    await api.put(`/admin/admission/applications/${id}`, { status, notes });
    onChanged();
    onClose();
  }, 'Application updated');

  const fieldValue = (f) => {
    if (f.type === 'class') return data.class_name;
    const v = data.data[f.key];
    if (v === undefined || v === '') return null;
    return v === true ? 'Yes' : String(v);
  };

  return (
    <Modal wide title={data ? `${data.app_no}: ${data.student_name}` : 'Application'} onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
      {loading && <Spinner />}
      {error && <Alert>{error.message}</Alert>}
      {data && (
        <div className="stack">
          <div className="grid-2">
            <div className="field"><label htmlFor="ap-status">Status</label>
              <select id="ap-status" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="ap-notes">Internal notes</label><input id="ap-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <p style={{ fontSize: '.9rem' }}>Applied {formatDateTime(data.created_at)} · Session {data.session_year} · Fee BDT {Number(data.fee_amount)} <span className={`badge ${payBadge[data.payment_status]}`}>{payLabel[data.payment_status]}</span></p>
          {data.form.sections.map((section) => {
            const rows = section.fields.filter((f) => f.type !== 'file').map((f) => [f.label, fieldValue(f)]).filter(([, v]) => v !== null && v !== undefined);
            const files = section.fields.filter((f) => f.type === 'file' && data.files[f.key]);
            if (!rows.length && !files.length) return null;
            return (
              <div key={section.id}>
                <h3 style={{ fontSize: '.98rem', marginBottom: 6 }}>{section.title}</h3>
                {rows.map(([label, value]) => <div className="step-row" key={label}><span>{label}</span><span style={{ fontWeight: 600 }}>{value}</span></div>)}
                {files.map((f) => (
                  <div className="step-row" key={f.key}><span>{f.label}</span><a href={apiUrl(`/admin/admission/applications/${id}/files/${f.key}`)} target="_blank" rel="noopener noreferrer">Open file</a></div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function Applications({ classes }) {
  const [filters, setFilters] = useState({ status: '', class_id: '', search: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const run = useAction();
  const qs = new URLSearchParams({ page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
  const { data, loading, error, reload } = useLoad(`/admin/admission/applications?${qs}`);
  const setFilter = (k) => (e) => { setPage(1); setFilters({ ...filters, [k]: e.target.value }); };
  return (
    <>
      <div className="toolbar">
        <div className="field"><label htmlFor="ap-s">Search</label><input id="ap-s" placeholder="Number, name or mobile" value={filters.search} onChange={setFilter('search')} /></div>
        <div className="field"><label htmlFor="ap-st">Status</label><select id="ap-st" value={filters.status} onChange={setFilter('status')}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label htmlFor="ap-c">Class</label><select id="ap-c" value={filters.class_id} onChange={setFilter('class_id')}><option value="">All</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      </div>
      {error && <Alert>{error.message}</Alert>}
      {loading && !data && <Spinner />}
      {data && (data.items.length === 0 ? <div className="box empty">No applications found.</div> : (
        <>
          <div className="scroll">
            <table className="ad-table">
              <thead><tr><th>Number</th><th>Student</th><th>Class</th><th>Mobile</th><th>Status</th><th>Fee</th><th>Date</th><th /></tr></thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }}><strong>{a.app_no}</strong></td><td>{a.student_name}</td><td>{a.class_name}</td><td>{a.mobile}</td>
                    <td><span className={`badge ${statusBadge[a.status]}`} style={{ textTransform: 'capitalize' }}>{a.status}</span></td>
                    <td><span className={`badge ${payBadge[a.payment_status]}`}>{payLabel[a.payment_status]}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(a.created_at)}</td>
                    <td className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(a.id)}>Open</button>
                      <ConfirmDelete message={`Delete ${a.app_no} and its documents? This cannot be undone.`} onConfirm={() => run(async () => { await api.del(`/admin/admission/applications/${a.id}`); reload(); }, 'Deleted')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      ))}
      {open && <ApplicationDetail id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

const TYPES = [
  ['text', 'Short text'], ['textarea', 'Long text'], ['email', 'Email'], ['tel', 'Phone'], ['number', 'Number'], ['date', 'Date'],
  ['select', 'Dropdown'], ['radio', 'Single choice'], ['checkbox', 'Tick box'], ['file', 'File upload'],
];
const PATTERNS = [['', 'None'], ['mobile', 'Bangladeshi mobile number'], ['brn', 'Birth registration (17 digits)'], ['nid', 'NID (10, 13 or 17 digits)']];

function FieldEditor({ field, onSave, onClose }) {
  const [f, setF] = useState({ ...field, optionsText: (field.options || []).join('\n') });
  const save = () => {
    const out = { ...f, options: f.optionsText.split('\n').map((s) => s.trim()).filter(Boolean) };
    delete out.optionsText;
    if (!out.key) out.key = out.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `field_${Date.now()}`;
    onSave(out);
  };
  return (
    <Modal title={field.key ? 'Edit field' : 'Add field'} onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.label?.trim()} onClick={save}>Done</button></>}>
      <div className="grid-2">
        <div className="field full"><label htmlFor="fe-label">Label</label><input id="fe-label" value={f.label || ''} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
        {!f.locked && (
          <div className="field"><label htmlFor="fe-type">Type</label><select id="fe-type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        )}
        <div className="field"><label htmlFor="fe-w">Width</label><select id="fe-w" value={f.width || 'half'} onChange={(e) => setF({ ...f, width: e.target.value })}><option value="half">Half</option><option value="full">Full</option></select></div>
        {['select', 'radio'].includes(f.type) && (
          <div className="field full"><label htmlFor="fe-o">Choices, one per line</label><textarea id="fe-o" value={f.optionsText} onChange={(e) => setF({ ...f, optionsText: e.target.value })} /></div>
        )}
        {f.type === 'file' && (
          <div className="field"><label htmlFor="fe-a">Accepted files</label><select id="fe-a" value={f.accept || 'document'} onChange={(e) => setF({ ...f, accept: e.target.value })}><option value="document">PDF or image</option><option value="image">Image only</option></select></div>
        )}
        {['text', 'tel'].includes(f.type) && !f.locked && (
          <div className="field"><label htmlFor="fe-p">Format check</label><select id="fe-p" value={f.pattern || ''} onChange={(e) => setF({ ...f, pattern: e.target.value })}>{PATTERNS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        )}
        <div className="field full"><label htmlFor="fe-h">Help text</label><input id="fe-h" value={f.help || ''} onChange={(e) => setF({ ...f, help: e.target.value })} /></div>
        {!f.locked && <div className="full"><Switch checked={f.required} onChange={(required) => setF({ ...f, required })} label="Required" /></div>}
      </div>
    </Modal>
  );
}

function FormBuilder() {
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { api.get('/admin/admission/form').then(setForm); }, []);
  if (!form) return <Spinner />;

  const updateSection = (i, patch) => setForm({ ...form, sections: form.sections.map((s, n) => (n === i ? { ...s, ...patch } : s)) });
  const swap = (arr, i, d) => {
    const next = [...arr];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  };
  const save = async () => {
    setBusy(true);
    try {
      setForm(await api.put('/admin/admission/form', form));
      toast('Admission form saved');
    } catch (err) {
      toast(err.message, true);
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!window.confirm('Replace this form with the standard admission form? Your changes will be lost.')) return;
    setForm(await api.post('/admin/admission/form/reset'));
    toast('Standard form restored');
  };
  const saveField = (field) => {
    const { s, i } = editing;
    const fields = [...form.sections[s].fields];
    if (i === null) fields.push(field);
    else fields[i] = field;
    updateSection(s, { fields });
    setEditing(null);
  };

  return (
    <>
      <div className="box stack" style={{ marginBottom: 14 }}>
        <div className="field"><label htmlFor="fb-intro">Instructions at the top of the form</label><textarea id="fb-intro" value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} /></div>
        <div className="field"><label htmlFor="fb-dec">Declaration the applicant must accept</label><textarea id="fb-dec" value={form.declaration} onChange={(e) => setForm({ ...form, declaration: e.target.value })} /></div>
      </div>
      {form.sections.map((section, si) => (
        <div className="builder-section" key={section.id}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor={`sec-${si}`}>Section title</label><input id={`sec-${si}`} value={section.title} onChange={(e) => updateSection(si, { title: e.target.value })} /></div>
            <button className="icon-btn" aria-label="Move section up" disabled={si === 0} onClick={() => setForm({ ...form, sections: swap(form.sections, si, -1) })}><ArrowUp size={14} /></button>
            <button className="icon-btn" aria-label="Move section down" disabled={si === form.sections.length - 1} onClick={() => setForm({ ...form, sections: swap(form.sections, si, 1) })}><ArrowDown size={14} /></button>
            <button className="icon-btn" aria-label="Delete section" disabled={section.fields.some((f) => f.locked)} title={section.fields.some((f) => f.locked) ? 'Contains required system fields' : 'Delete section'} onClick={() => window.confirm(`Delete the section "${section.title}"?`) && setForm({ ...form, sections: form.sections.filter((_, n) => n !== si) })}><Trash2 size={14} /></button>
          </div>
          {section.fields.map((f, fi) => (
            <div className="builder-field" key={f.key}>
              <span className="name">{f.locked && <Lock size={12} aria-label="System field" />} {f.label}{f.required ? ' *' : ''} <span className="badge">{TYPES.find(([v]) => v === f.type)?.[1] || 'Class'}</span></span>
              <button className="icon-btn" aria-label="Move up" disabled={fi === 0} onClick={() => updateSection(si, { fields: swap(section.fields, fi, -1) })}><ArrowUp size={14} /></button>
              <button className="icon-btn" aria-label="Move down" disabled={fi === section.fields.length - 1} onClick={() => updateSection(si, { fields: swap(section.fields, fi, 1) })}><ArrowDown size={14} /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ s: si, i: fi, field: f })}>Edit</button>
              <button className="icon-btn" aria-label="Delete field" disabled={f.locked} onClick={() => updateSection(si, { fields: section.fields.filter((_, n) => n !== fi) })}><Trash2 size={14} /></button>
            </div>
          ))}
          <p style={{ marginTop: 10 }}><button className="btn btn-ghost btn-sm" onClick={() => setEditing({ s: si, i: null, field: { label: '', type: 'text', required: false, width: 'half' } })}><Plus size={14} /> Add field</button></p>
        </div>
      ))}
      <div className="ad-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save form'}</button>
        <button className="btn btn-ghost" onClick={() => setForm({ ...form, sections: [...form.sections, { id: `s${Date.now()}`, title: 'New section', fields: [] }] })}><Plus size={14} /> Add section</button>
        <button className="btn btn-ghost" onClick={reset}>Restore standard form</button>
      </div>
      {editing && <FieldEditor field={editing.field} onSave={saveField} onClose={() => setEditing(null)} />}
    </>
  );
}

export default function AdmissionAdmin() {
  const { user } = useAdmin();
  const [tab, setTab] = useState('applications');
  const [classes, setClasses] = useState([]);
  useEffect(() => { api.get('/admin/modules/admission').then((m) => setClasses(m.classes)).catch(() => {}); }, []);
  return (
    <>
      <PageHead title="Admission" intro="Review applications and edit the admission form.">
        {user.role === 'admin' && <Link className="btn btn-ghost" to="/modules/admission"><Settings size={15} /> Settings and fees</Link>}
      </PageHead>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'applications'} onClick={() => setTab('applications')}>Applications</button>
        <button role="tab" aria-selected={tab === 'form'} onClick={() => setTab('form')}>Admission form</button>
      </div>
      {tab === 'applications' ? <Applications classes={classes} /> : <FormBuilder />}
    </>
  );
}
