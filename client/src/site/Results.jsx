import React, { Fragment, useState } from 'react';
import { Printer } from 'lucide-react';
import { api, asset } from '../lib/api.js';
import { useSite } from '../lib/site.jsx';
import { useLang } from '../lib/i18n.jsx';
import { Alert, Spinner, useLoad } from '../lib/ui.jsx';
import { PageHero } from './Info.jsx';

function Marksheet({ data }) {
  const { t } = useLang();
  const { result, student } = data;
  const passed = result.status === 'passed';
  return (
    <div className="panel" style={{ marginTop: 22 }}>
      <div className="marksheet-head">
        {data.school.logo && <img src={asset(data.school.logo)} alt="" />}
        <h2>{data.school.name}</h2>
        <p>{data.exam.name} {data.exam.session_year} · {data.class_name}</p>
      </div>
      <div className="info-grid">
        <div><span>{t('Student')}</span>{student.name}</div>
        <div><span>{t('Roll')}</span>{student.roll}</div>
        {student.reg_no && <div><span>{t('Registration')}</span>{student.reg_no}</div>}
        {student.group_name && <div><span>{t('Group')}</span>{student.group_name}</div>}
        {student.father_name && <div><span>{t('Father')}</span>{student.father_name}</div>}
        {student.mother_name && <div><span>{t('Mother')}</span>{student.mother_name}</div>}
      </div>
      <div className="summary">
        <div className={passed ? 'passed' : 'failed'}><b>{t(passed ? 'Passed' : 'Failed')}</b><span>{t('Result')}</span></div>
        <div><b>{result.gpa.toFixed(2)}</b><span>{t('GPA')}</span></div>
        <div><b>{result.letter}</b><span>{t('Grade')}</span></div>
        <div><b>{result.total}</b><span>{t('of')} {result.fullTotal}</span></div>
        {data.position && <div><b>{data.position}</b><span>{t('Position of')} {data.class_size}</span></div>}
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>{t('Subject')}</th><th>{t('Full')}</th><th>{t('Marks')}</th><th>{t('Grade')}</th><th>{t('Point')}</th></tr></thead>
          <tbody>
            {result.lines.map((l) => (
              <Fragment key={l.name}>
                <tr>
                  <td><strong>{l.name}</strong>{l.optional ? <span className="badge" style={{ marginLeft: 8 }}>{t('4th subject')}</span> : null}</td>
                  <td>{l.full}</td>
                  <td>{l.absent ? t('Absent') : l.obtained}</td>
                  <td><strong style={{ color: l.point === 0 ? 'var(--bad)' : undefined }}>{l.letter}</strong></td>
                  <td>{l.point.toFixed(2)}</td>
                </tr>
                {l.papers.length > 1 && l.papers.map((p) => (
                  <tr className="sub" key={p.name}><td>{p.name}</td><td>{p.full}</td><td>{p.absent ? t('Absent') : p.marks}</td><td /><td /></tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="no-print" style={{ marginTop: 18, textAlign: 'right' }}>
        <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16} /> {t('Print')}</button>
      </p>
    </div>
  );
}

export default function Results() {
  const { t } = useLang();
  const { modules } = useSite();
  const verifyBy = modules.results?.config.verify_by;
  const { loading, data, error: loadError } = useLoad('/public/results/options');
  const [form, setForm] = useState({ exam_id: '', class_id: '', roll: '', dob: '', reg_no: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.post('/public/results/lookup', form));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero title={t('Results')} intro={t('Choose the exam and class, then enter the student\'s details to see the marksheet.')} />
      <div className="inner" style={{ paddingTop: 12 }}><div className="narrow">
        {loading && <Spinner />}
        {loadError && <p className="empty">{loadError.message}</p>}
        {data && data.exams.length === 0 && <p className="empty">{t('No results have been published yet.')}</p>}
        {data && data.exams.length > 0 && (
          <form className="panel form-grid no-print" onSubmit={submit}>
            <div className="field">
              <label htmlFor="r-exam">{t('Exam')}</label>
              <select id="r-exam" required value={form.exam_id} onChange={set('exam_id')}>
                <option value="">{t('Select exam')}</option>
                {data.exams.map((x) => <option key={x.id} value={x.id}>{x.name} {x.session_year}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="r-class">{t('Class')}</label>
              <select id="r-class" required value={form.class_id} onChange={set('class_id')}>
                <option value="">{t('Select class')}</option>
                {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="r-roll">{t('Roll number')}</label>
              <input id="r-roll" type="number" min="1" inputMode="numeric" required value={form.roll} onChange={set('roll')} />
            </div>
            {verifyBy === 'dob' && (
              <div className="field">
                <label htmlFor="r-dob">{t('Date of birth')}</label>
                <input id="r-dob" type="date" required value={form.dob} onChange={set('dob')} />
              </div>
            )}
            {verifyBy === 'reg_no' && (
              <div className="field">
                <label htmlFor="r-reg">{t('Registration number')}</label>
                <input id="r-reg" required value={form.reg_no} onChange={set('reg_no')} />
              </div>
            )}
            <div className="span-full">
              <button className="btn btn-primary" disabled={busy}>{t(busy ? 'Searching...' : 'View result')}</button>
            </div>
            {error && <div className="span-full"><Alert>{error}</Alert></div>}
          </form>
        )}
        {result && <Marksheet data={result} />}
      </div></div>
    </>
  );
}
