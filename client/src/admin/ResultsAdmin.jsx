import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Plus, Settings } from 'lucide-react';
import { api } from '../lib/api.js';
import { Alert, Spinner, useLoad } from '../lib/ui.jsx';
import { ConfirmDelete, Modal, PageHead, Switch, useAction, useToast } from './widgets.jsx';
import { useAdmin } from './AdminApp.jsx';

const thisYear = new Date().getFullYear();

function Editor({ title, value, onClose, onSave, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave(value);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button></>}>
      {error && <div style={{ marginBottom: 14 }}><Alert>{error}</Alert></div>}
      {children}
    </Modal>
  );
}

const Input = ({ label, value, onChange, type = 'text', help, ...rest }) => (
  <div className="field">
    <label>{label}<input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} /></label>
    {help && <span className="help">{help}</span>}
  </div>
);
const Select = ({ label, value, onChange, children, help }) => (
  <div className="field">
    <label>{label}<select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>{children}</select></label>
    {help && <span className="help">{help}</span>}
  </div>
);

function ExamsTab({ meta, reload, canSetup, canPublish }) {
  const [editing, setEditing] = useState(null);
  const run = useAction();
  const save = async (e) => {
    if (e.id) await api.put(`/admin/results/exams/${e.id}`, e);
    else await api.post('/admin/results/exams', e);
    reload();
  };
  return (
    <>
      {canSetup && <p style={{ marginBottom: 14 }}><button className="btn btn-primary" onClick={() => setEditing({ name: '', session_year: thisYear, scale_id: meta.scales.find((s) => s.is_default)?.id })}><Plus size={16} /> New exam</button></p>}
      {meta.exams.length === 0 ? <div className="box empty">Create an exam to start entering marks.</div> : (
        <div className="scroll">
          <table className="ad-table">
            <thead><tr><th>Exam</th><th>Session</th><th>Grading</th><th>Published</th><th /></tr></thead>
            <tbody>
              {meta.exams.map((x) => (
                <tr key={x.id}>
                  <td><strong>{x.name}</strong></td>
                  <td>{x.session_year}</td>
                  <td>{x.scale_name}</td>
                  <td><Switch disabled={!canPublish} checked={x.published} label={<span className="sr-only">Publish {x.name}</span>} onChange={(published) => {
                    if (published && !window.confirm(`Publish ${x.name}? Students will be able to see their results.`)) return;
                    run(async () => { await api.post(`/admin/results/exams/${x.id}/publish`, { published }); reload(); }, published ? 'Results published' : 'Results hidden');
                  }} /></td>
                  <td className="actions">
                    {canSetup && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(x)}>Edit</button>}
                    {canSetup && <ConfirmDelete message={`Delete ${x.name} and all its marks? This cannot be undone.`} onConfirm={() => run(async () => { await api.del(`/admin/results/exams/${x.id}`); reload(); }, 'Deleted')} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Editor title={editing.id ? 'Edit exam' : 'New exam'} value={editing} onClose={() => setEditing(null)} onSave={save}>
          <div className="stack">
            <Input label="Exam name" placeholder="Annual Examination" value={editing.name} onChange={(name) => setEditing({ ...editing, name })} />
            <Input label="Session year" type="number" value={editing.session_year} onChange={(session_year) => setEditing({ ...editing, session_year })} />
            <Select label="Grading system" value={editing.scale_id} onChange={(scale_id) => setEditing({ ...editing, scale_id })}>
              {meta.scales.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </Editor>
      )}
    </>
  );
}

function MarksTab({ meta }) {
  const [sel, setSel] = useState({ exam_id: '', class_id: '', subject_id: '' });
  const subjects = meta.subjects.filter((s) => String(s.class_id) === String(sel.class_id) && s.active);
  const url = sel.exam_id && sel.subject_id ? `/admin/results/marks?exam_id=${sel.exam_id}&subject_id=${sel.subject_id}` : null;
  const { data, loading, error, reload } = useLoad(url);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => setRows(data?.items || []), [data]);
  const setRow = (id, patch) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const full = Number(data?.subject?.full_marks);

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/admin/results/marks', { exam_id: sel.exam_id, subject_id: sel.subject_id, entries: rows.map((r) => ({ student_id: r.id, marks: r.marks, absent: r.absent })) });
      toast('Marks saved');
      reload();
    } catch (err) {
      toast(err.message, true);
    } finally {
      setBusy(false);
    }
  };

  const nextOnEnter = (e, i) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    document.getElementById(`mark-${i + 1}`)?.select();
  };

  return (
    <>
      <div className="toolbar">
        <Select label="Exam" value={sel.exam_id} onChange={(exam_id) => setSel({ ...sel, exam_id })}><option value="">Select</option>{meta.exams.map((x) => <option key={x.id} value={x.id}>{x.name} {x.session_year}</option>)}</Select>
        <Select label="Class" value={sel.class_id} onChange={(class_id) => setSel({ ...sel, class_id, subject_id: '' })}><option value="">Select</option>{meta.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select label="Subject" value={sel.subject_id} onChange={(subject_id) => setSel({ ...sel, subject_id })}><option value="">Select</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}{s.group_name ? ` (${s.group_name})` : ''}{s.is_optional ? ' (4th)' : ''}</option>)}</Select>
      </div>
      {!url && <div className="box empty">Choose an exam, class and subject.</div>}
      {loading && <Spinner />}
      {error && <Alert>{error.message}</Alert>}
      {url && data && !loading && (rows.length === 0 ? <div className="box empty">No students take this subject in that session.</div> : (
        <>
          <div className="scroll">
            <table className="ad-table">
              <thead><tr><th>Roll</th><th>Student</th><th>Marks (out of {full})</th><th>Absent</th></tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const invalid = r.marks !== null && r.marks !== '' && !(Number(r.marks) >= 0 && Number(r.marks) <= full);
                  return (
                    <tr key={r.id}>
                      <td>{r.roll}</td>
                      <td>{r.name}</td>
                      <td>
                        <div className={`field ${invalid ? 'has-err' : ''}`}>
                          <input id={`mark-${i}`} className="marks-input" type="number" min="0" max={full} step="0.5" aria-label={`Marks for roll ${r.roll}`} disabled={r.absent} value={r.marks ?? ''} onChange={(e) => setRow(r.id, { marks: e.target.value })} onKeyDown={(e) => nextOnEnter(e, i)} />
                        </div>
                      </td>
                      <td><label className="check"><input type="checkbox" checked={r.absent} onChange={(e) => setRow(r.id, { absent: e.target.checked, marks: e.target.checked ? null : r.marks })} /><span className="sr-only">Absent</span></label></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 14 }}><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save marks'}</button></p>
        </>
      ))}
    </>
  );
}

function SheetTab({ meta }) {
  const [sel, setSel] = useState({ exam_id: '', class_id: '' });
  const { data, loading, error } = useLoad(sel.exam_id && sel.class_id ? `/admin/results/tabulation?exam_id=${sel.exam_id}&class_id=${sel.class_id}` : null);
  const badge = { passed: 'badge-good', failed: 'badge-bad', incomplete: 'badge-warn' };
  return (
    <>
      <div className="toolbar">
        <Select label="Exam" value={sel.exam_id} onChange={(exam_id) => setSel({ ...sel, exam_id })}><option value="">Select</option>{meta.exams.map((x) => <option key={x.id} value={x.id}>{x.name} {x.session_year}</option>)}</Select>
        <Select label="Class" value={sel.class_id} onChange={(class_id) => setSel({ ...sel, class_id })}><option value="">Select</option>{meta.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      </div>
      {loading && <Spinner />}
      {error && <Alert>{error.message}</Alert>}
      {data && !loading && (data.rows.length === 0 ? <div className="box empty">No students in this class for that session.</div> : (
        <div className="scroll">
          <table className="ad-table">
            <thead><tr><th>Roll</th><th>Student</th><th>Group</th><th>Total</th><th>GPA</th><th>Grade</th><th>Result</th><th>Position</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.roll}</td><td>{r.name}</td><td>{r.group_name || '-'}</td>
                  <td>{r.result.total}/{r.result.fullTotal}</td>
                  <td>{r.result.gpa === null ? '-' : r.result.gpa.toFixed(2)}</td>
                  <td>{r.result.letter || '-'}</td>
                  <td><span className={`badge ${badge[r.result.status]}`} style={{ textTransform: 'capitalize' }}>{r.result.status}</span></td>
                  <td>{r.position || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

const parseCsv = (text) => {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
      } else if ((ch === ',' || ch === '\t') && !quoted) {
        cells.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
};

const CSV_HEADER = 'roll,name,reg_no,dob,gender,group_name,father_name,mother_name';

function StudentsTab({ meta, canEdit }) {
  const [sel, setSel] = useState({ class_id: meta.classes[0]?.id || '', session_year: thisYear });
  const { data, loading, error, reload } = useLoad(sel.class_id && sel.session_year ? `/admin/results/students?class_id=${sel.class_id}&session_year=${sel.session_year}` : null);
  const [editing, setEditing] = useState(null);
  const [importText, setImportText] = useState(null);
  const run = useAction();
  const toast = useToast();

  const optionalChoices = (s) => meta.subjects.filter((x) => String(x.class_id) === String(sel.class_id) && x.is_optional && (!x.group_name || x.group_name === s.group_name));
  const classHasGroups = meta.subjects.some((x) => String(x.class_id) === String(sel.class_id) && x.group_name);

  const save = async (s) => {
    const body = { ...s, ...sel };
    if (s.id) await api.put(`/admin/results/students/${s.id}`, body);
    else await api.post('/admin/results/students', body);
    reload();
  };

  const doImport = async () => {
    const parsed = parseCsv(importText);
    if (parsed[0]?.[0]?.toLowerCase() === 'roll') parsed.shift();
    const keys = CSV_HEADER.split(',');
    const rows = parsed.map((cells) => Object.fromEntries(keys.map((k, i) => [k, cells[i] || ''])));
    try {
      const r = await api.post('/admin/results/students/import', { ...sel, rows });
      toast(`${r.imported} students imported`);
      setImportText(null);
      reload();
    } catch (err) {
      toast(err.message, true);
    }
  };

  return (
    <>
      <div className="toolbar">
        <Select label="Class" value={sel.class_id} onChange={(class_id) => setSel({ ...sel, class_id })}>{meta.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Input label="Session" type="number" value={sel.session_year} onChange={(session_year) => setSel({ ...sel, session_year })} />
        {canEdit && <button className="btn btn-primary" onClick={() => setEditing({ roll: '', name: '', active: true })}><Plus size={16} /> Add student</button>}
        {canEdit && <button className="btn btn-ghost" onClick={() => setImportText('')}>Import CSV</button>}
      </div>
      {loading && <Spinner />}
      {error && <Alert>{error.message}</Alert>}
      {data && !loading && (data.items.length === 0 ? <div className="box empty">No students in this class for this session.</div> : (
        <div className="scroll">
          <table className="ad-table">
            <thead><tr><th>Roll</th><th>Name</th><th>Group</th><th>Date of birth</th><th>Reg. no</th><th /></tr></thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td>{s.roll}</td><td><strong>{s.name}</strong>{!s.active && <span className="badge" style={{ marginLeft: 6 }}>Inactive</span>}</td><td>{s.group_name || '-'}</td><td>{s.dob || <span className="badge badge-warn">Missing</span>}</td><td>{s.reg_no || '-'}</td>
                  <td className="actions">
                    {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...s, active: Boolean(s.active) })}>Edit</button>}
                    {canEdit && <ConfirmDelete message={`Delete ${s.name} and all their marks? This cannot be undone.`} onConfirm={() => run(async () => { await api.del(`/admin/results/students/${s.id}`); reload(); }, 'Deleted')} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {editing && (
        <Editor title={editing.id ? 'Edit student' : 'Add student'} value={editing} onClose={() => setEditing(null)} onSave={save}>
          <div className="grid-2">
            <Input label="Roll" type="number" min="1" value={editing.roll} onChange={(roll) => setEditing({ ...editing, roll })} />
            <Input label="Full name" value={editing.name} onChange={(name) => setEditing({ ...editing, name })} />
            <Input label="Date of birth" type="date" value={editing.dob} onChange={(dob) => setEditing({ ...editing, dob })} help="Used to view the result online." />
            <Input label="Registration number" value={editing.reg_no} onChange={(reg_no) => setEditing({ ...editing, reg_no })} />
            <Select label="Gender" value={editing.gender} onChange={(gender) => setEditing({ ...editing, gender })}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></Select>
            {classHasGroups && <Select label="Group" value={editing.group_name} onChange={(group_name) => setEditing({ ...editing, group_name, optional_subject_id: '' })}><option value="">Select</option>{meta.groups.map((g) => <option key={g}>{g}</option>)}</Select>}
            {optionalChoices(editing).length > 0 && (
              <Select label="Fourth subject" value={editing.optional_subject_id} onChange={(optional_subject_id) => setEditing({ ...editing, optional_subject_id })}><option value="">None</option>{optionalChoices(editing).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
            )}
            <Input label="Father's name" value={editing.father_name} onChange={(father_name) => setEditing({ ...editing, father_name })} />
            <Input label="Mother's name" value={editing.mother_name} onChange={(mother_name) => setEditing({ ...editing, mother_name })} />
            <div className="full"><Switch checked={editing.active} onChange={(active) => setEditing({ ...editing, active })} label="Active" /></div>
          </div>
        </Editor>
      )}
      {importText !== null && (
        <Modal title="Import students" onClose={() => setImportText(null)} footer={<><button className="btn btn-ghost" onClick={() => setImportText(null)}>Cancel</button><button className="btn btn-primary" disabled={!importText.trim()} onClick={doImport}>Import</button></>}>
          <p style={{ fontSize: '.9rem', marginBottom: 10 }}>Paste rows from Excel or a CSV file, in this column order. A student with an existing roll is updated. Dates look like 2012-05-31.</p>
          <div className="code-box" style={{ marginBottom: 10 }}>{CSV_HEADER}</div>
          <div className="field"><textarea rows={10} aria-label="Student rows" value={importText} onChange={(e) => setImportText(e.target.value)} /></div>
        </Modal>
      )}
    </>
  );
}

function CurriculumTab({ meta, reload }) {
  const [classId, setClassId] = useState(meta.classes[0]?.id || '');
  const [subject, setSubject] = useState(null);
  const [klass, setKlass] = useState(null);
  const run = useAction();
  const subjects = meta.subjects.filter((s) => String(s.class_id) === String(classId));
  const current = meta.classes.find((c) => String(c.id) === String(classId));

  const saveSubject = async (s) => {
    const body = { ...s, class_id: classId, is_optional: Boolean(s.is_optional), active: s.active !== false && s.active !== 0 };
    if (s.id) await api.put(`/admin/results/subjects/${s.id}`, body);
    else await api.post('/admin/results/subjects', body);
    reload();
  };
  const saveClass = async (k) => {
    if (k.id) await api.put(`/admin/results/classes/${k.id}`, { ...k, active: Boolean(k.active) });
    else await api.post('/admin/results/classes', k);
    reload();
  };

  return (
    <>
      <div className="toolbar">
        <Select label="Class" value={classId} onChange={setClassId}>{meta.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <button className="btn btn-primary" onClick={() => setSubject({ name: '', full_marks: 100, sort_order: subjects.length, active: true })}><Plus size={16} /> Add subject</button>
        {current && <button className="btn btn-ghost" onClick={() => setKlass(current)}>Edit class</button>}
        <button className="btn btn-ghost" onClick={() => setKlass({ name: '', level: Math.max(0, ...meta.classes.map((c) => c.level)) + 1, active: true })}>Add class</button>
        {current && <ConfirmDelete label="Delete class" message={`Delete ${current.name} and its subjects?`} onConfirm={() => run(async () => { await api.del(`/admin/results/classes/${current.id}`); setClassId(''); reload(); }, 'Deleted')} />}
      </div>
      <div style={{ marginBottom: 14 }}><Alert kind="info">Starting list follows the NCTB structure. Please check it against your school's current syllabus. Subjects with the same "Combined subject" name, such as Bangla 1st and 2nd Paper, are graded together as one subject.</Alert></div>
      {subjects.length === 0 ? <div className="box empty">No subjects in this class yet.</div> : (
        <div className="scroll">
          <table className="ad-table">
            <thead><tr><th>Subject</th><th>Code</th><th>Group</th><th>Combined</th><th>Full marks</th><th>Type</th><th /></tr></thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong>{!s.active && <span className="badge" style={{ marginLeft: 6 }}>Inactive</span>}</td>
                  <td>{s.code || '-'}</td><td>{s.group_name || 'All'}</td><td>{s.paper_group || '-'}</td><td>{Number(s.full_marks)}</td>
                  <td>{s.is_optional ? <span className="badge badge-brand">4th subject</span> : 'Compulsory'}</td>
                  <td className="actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setSubject({ ...s, full_marks: Number(s.full_marks), is_optional: Boolean(s.is_optional), active: Boolean(s.active) })}>Edit</button>
                    <ConfirmDelete onConfirm={() => run(async () => { await api.del(`/admin/results/subjects/${s.id}`); reload(); }, 'Deleted')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {subject && (
        <Editor title={subject.id ? 'Edit subject' : 'Add subject'} value={subject} onClose={() => setSubject(null)} onSave={saveSubject}>
          <div className="grid-2">
            <Input label="Subject name" value={subject.name} onChange={(name) => setSubject({ ...subject, name })} />
            <Input label="Subject code" value={subject.code} onChange={(code) => setSubject({ ...subject, code })} />
            <Input label="Full marks" type="number" value={subject.full_marks} onChange={(full_marks) => setSubject({ ...subject, full_marks })} />
            <Select label="Group" value={subject.group_name} onChange={(group_name) => setSubject({ ...subject, group_name })}><option value="">All students</option>{meta.groups.map((g) => <option key={g}>{g}</option>)}</Select>
            <Input label="Combined subject" value={subject.paper_group} onChange={(paper_group) => setSubject({ ...subject, paper_group })} help='For 1st and 2nd papers, for example "Bangla".' />
            <Input label="Order" type="number" value={subject.sort_order} onChange={(sort_order) => setSubject({ ...subject, sort_order })} />
            <div className="full stack">
              <Switch checked={subject.is_optional} onChange={(is_optional) => setSubject({ ...subject, is_optional })} label="Can be chosen as the fourth (optional) subject" />
              <Switch checked={subject.active} onChange={(active) => setSubject({ ...subject, active })} label="Active" />
            </div>
          </div>
        </Editor>
      )}
      {klass && (
        <Editor title={klass.id ? 'Edit class' : 'Add class'} value={klass} onClose={() => setKlass(null)} onSave={saveClass}>
          <div className="stack">
            <Input label="Class name" value={klass.name} onChange={(name) => setKlass({ ...klass, name })} />
            <Input label="Order number" type="number" value={klass.level} onChange={(level) => setKlass({ ...klass, level })} />
            {klass.id && <Switch checked={klass.active} onChange={(active) => setKlass({ ...klass, active })} label="Active" />}
          </div>
        </Editor>
      )}
    </>
  );
}

function ScaleEditor({ scale, onClose, onSave }) {
  const [s, setS] = useState(scale);
  const setBand = (i, patch) => setS({ ...s, bands: s.bands.map((b, n) => (n === i ? { ...b, ...patch } : b)) });
  return (
    <Editor title={s.id ? 'Edit grading scale' : 'New grading scale'} value={s} onClose={onClose} onSave={onSave}>
      <div className="stack">
        <Input label="Name" value={s.name} onChange={(name) => setS({ ...s, name })} />
        <div className="scroll">
          <table className="ad-table">
            <thead><tr><th>Grade</th><th>From marks %</th><th>Grade point</th><th /></tr></thead>
            <tbody>
              {s.bands.map((b, i) => (
                <tr key={i}>
                  <td><input className="input marks-input" aria-label="Grade" value={b.letter} onChange={(e) => setBand(i, { letter: e.target.value })} /></td>
                  <td><input className="input marks-input" aria-label="Lowest percent" type="number" min="0" max="100" value={b.min} onChange={(e) => setBand(i, { min: e.target.value })} /></td>
                  <td><input className="input marks-input" aria-label="Grade point" type="number" min="0" step="0.25" value={b.point} onChange={(e) => setBand(i, { point: e.target.value })} /></td>
                  <td className="actions"><ConfirmDelete message="Remove this grade?" onConfirm={() => setS({ ...s, bands: s.bands.filter((_, n) => n !== i) })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p><button type="button" className="btn btn-ghost btn-sm" onClick={() => setS({ ...s, bands: [...s.bands, { letter: '', min: '', point: '' }] })}><Plus size={14} /> Add grade</button></p>
        <Switch checked={s.rules.fail_on_any_f} onChange={(v) => setS({ ...s, rules: { ...s.rules, fail_on_any_f: v } })} label="A fail in any compulsory subject fails the whole result" />
        <Switch checked={s.rules.optional_bonus} onChange={(v) => setS({ ...s, rules: { ...s.rules, optional_bonus: v } })} label="Fourth subject only adds the points above a threshold" />
        {s.rules.optional_bonus && <Input label="Threshold" type="number" step="0.5" value={s.rules.optional_bonus_above} onChange={(v) => setS({ ...s, rules: { ...s.rules, optional_bonus_above: v } })} />}
      </div>
    </Editor>
  );
}

function GradingTab({ meta, reload }) {
  const [editing, setEditing] = useState(null);
  const run = useAction();
  const save = async (s) => {
    if (s.id) await api.put(`/admin/results/scales/${s.id}`, s);
    else await api.post('/admin/results/scales', s);
    reload();
  };
  return (
    <>
      {meta.scales.map((s) => (
        <div className="box" key={s.id}>
          <div className="ad-head" style={{ marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.05rem' }}>{s.name}</h2>
              <p>
                {s.is_system ? <span className="badge badge-brand">Standard, read-only</span> : null} {s.is_default ? <span className="badge badge-good">Default for new exams</span> : null}
              </p>
            </div>
            <div className="ad-actions">
              {!s.is_default && <button className="btn btn-ghost btn-sm" onClick={() => run(async () => { await api.post(`/admin/results/scales/${s.id}/default`); reload(); }, 'Default changed')}>Make default</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ name: `${s.name} (copy)`, bands: s.bands, rules: s.rules })}><Copy size={14} /> Copy</button>
              {!s.is_system && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>Edit</button>}
              {!s.is_system && <ConfirmDelete onConfirm={() => run(async () => { await api.del(`/admin/results/scales/${s.id}`); reload(); }, 'Deleted')} />}
            </div>
          </div>
          <div className="scroll">
            <table className="ad-table">
              <thead><tr><th>Grade</th><th>Marks from</th><th>Point</th></tr></thead>
              <tbody>{[...s.bands].sort((a, b) => b.min - a.min).map((b) => <tr key={b.letter}><td><strong>{b.letter}</strong></td><td>{b.min}%</td><td>{Number(b.point).toFixed(2)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="help" style={{ marginTop: 10, color: 'var(--muted)', fontSize: '.84rem' }}>
            {s.rules.fail_on_any_f ? 'A fail in any compulsory subject fails the result.' : 'A fail in one subject does not fail the whole result.'}{' '}
            {s.rules.optional_bonus ? `The fourth subject adds only points above ${s.rules.optional_bonus_above}.` : 'The fourth subject counts like any other subject.'}
          </p>
        </div>
      ))}
      {editing && <ScaleEditor scale={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}

export default function ResultsAdmin() {
  const { user } = useAdmin();
  const has = (p) => user.role === 'admin' || user.permissions.includes(p);
  const { data: meta, loading, error, reload } = useLoad('/admin/results/meta');

  const tabs = useMemo(() => [
    (has('results.setup') || has('results.publish')) && ['exams', 'Exams & publishing'],
    has('results.marks') && ['marks', 'Enter marks'],
    (has('results.marks') || has('results.publish')) && ['sheet', 'Result sheet'],
    (has('results.students') || has('results.marks')) && ['students', 'Students'],
    has('results.setup') && ['curriculum', 'Classes & subjects'],
    has('results.setup') && ['grading', 'Grading system'],
  ].filter(Boolean), [user]);
  const [tab, setTab] = useState(tabs[0]?.[0]);

  if (loading && !meta) return <Spinner />;
  if (error) return <Alert>{error.message}</Alert>;

  return (
    <>
      <PageHead title="Result Publication" intro="Set up the exam, enter marks by subject, check the result sheet, then publish.">
        {user.role === 'admin' && <Link className="btn btn-ghost" to="/modules/results"><Settings size={15} /> Settings</Link>}
      </PageHead>
      <div className="tabs" role="tablist">
        {tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>)}
      </div>
      {tab === 'exams' && <ExamsTab meta={meta} reload={reload} canSetup={has('results.setup')} canPublish={has('results.publish')} />}
      {tab === 'marks' && <MarksTab meta={meta} />}
      {tab === 'sheet' && <SheetTab meta={meta} />}
      {tab === 'students' && <StudentsTab meta={meta} canEdit={has('results.students')} />}
      {tab === 'curriculum' && <CurriculumTab meta={meta} reload={reload} />}
      {tab === 'grading' && <GradingTab meta={meta} reload={reload} />}
    </>
  );
}
