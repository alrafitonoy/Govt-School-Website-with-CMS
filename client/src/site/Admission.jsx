import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';
import { Alert, Spinner, useLoad } from '../lib/ui.jsx';
import { PageHero } from './Info.jsx';
import PaymentChooser from './PaymentChooser.jsx';

function Field({ field, value, error, onChange, classes, maxMb }) {
  const { t } = useLang();
  const id = `f-${field.key}`;
  const common = { id, required: field.required, 'aria-invalid': Boolean(error) };
  let control;
  switch (field.type) {
    case 'textarea':
      control = <textarea {...common} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'select':
      control = (
        <select {...common} value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t('Select')}</option>
          {(field.options || []).map((o) => <option key={o}>{o}</option>)}
        </select>
      );
      break;
    case 'class':
      control = (
        <select {...common} value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t('Select class')}</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.fee > 0 ? ` (fee BDT ${c.fee})` : ''}</option>)}
        </select>
      );
      break;
    case 'radio':
      control = (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
          {(field.options || []).map((o) => (
            <label key={o} className="check"><input type="radio" name={id} required={field.required} checked={value === o} onChange={() => onChange(o)} /> {o}</label>
          ))}
        </div>
      );
      break;
    case 'checkbox':
      return (
        <div className={`field ${field.width === 'full' ? 'span-full' : ''} ${error ? 'has-err' : ''}`}>
          <label className="check" style={{ fontWeight: 600 }}><input type="checkbox" required={field.required} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {field.label}</label>
          {error && <span className="err">{error}</span>}
        </div>
      );
    case 'file':
      control = (
        <input
          {...common}
          type="file"
          accept={field.accept === 'image' ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png'}
          onChange={(e) => onChange(e.target.files[0] || null)}
        />
      );
      break;
    default:
      control = (
        <input
          {...common}
          type={['email', 'tel', 'number', 'date'].includes(field.type) ? field.type : 'text'}
          inputMode={field.pattern ? 'numeric' : undefined}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
  return (
    <div className={`field ${field.width === 'full' ? 'span-full' : ''} ${error ? 'has-err' : ''}`}>
      <label htmlFor={id}>{field.label} {field.required && <span className="req" aria-hidden="true">*</span>}</label>
      {control}
      {field.type === 'file' && <span className="help">{field.accept === 'image' ? 'JPG or PNG' : 'PDF, JPG or PNG'}, up to {maxMb} MB.</span>}
      {field.help && <span className="help">{field.help}</span>}
      {error && <span className="err">{error}</span>}
    </div>
  );
}

function Done({ result, mobile }) {
  const { t } = useLang();
  const [paid, setPaid] = useState(null);
  return (
    <div className="panel" style={{ textAlign: 'center' }}>
      <div className="success-mark"><CheckCircle2 size={30} /></div>
      <h2 style={{ fontSize: '1.4rem' }}>{t('Application received')}</h2>
      <p style={{ marginTop: 8, color: 'var(--ink-2)' }}>{t('Keep this application number. You need it with your mobile number to check the status.')}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.6rem', margin: '14px 0' }}>{result.app_no}</p>
      <div style={{ textAlign: 'left', marginTop: 20 }}>
        {result.fee > 0 && !paid && <PaymentChooser appNo={result.app_no} mobile={mobile} fee={result.fee} methods={result.methods} onDone={(method) => setPaid(method)} />}
        {paid && <Alert kind="success">Thank you. {paid.mode === 'offline' ? 'Please pay at the school office and bring your application number.' : 'The school will check your payment and update your application.'}</Alert>}
      </div>
      <p style={{ marginTop: 20 }}><Link className="btn btn-ghost" to={`/admission/status?app_no=${encodeURIComponent(result.app_no)}`}>{t('Check application status')}</Link></p>
    </div>
  );
}

function ApplicationForm({ info }) {
  const { t } = useLang();
  const { form, classes, max_file_mb: maxMb } = info;
  const defaults = useMemo(() => Object.fromEntries(form.sections.flatMap((s) => s.fields).filter((f) => f.default).map((f) => [f.key, f.default])), [form]);
  const [values, setValues] = useState(defaults);
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const honeypot = useRef(null);

  useEffect(() => {
    if (result) window.scrollTo(0, 0);
  }, [result]);

  if (result) return <Done result={result} mobile={values.guardian_mobile} />;

  const classLevel = classes.find((c) => String(c.id) === String(values.class_applying))?.level;
  const visible = (f) => {
    if (!f.showIf) return true;
    if (f.showIf.levels) return f.showIf.levels.includes(classLevel);
    if (f.showIf.values) return f.showIf.values.includes(String(values[f.showIf.field] ?? ''));
    return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage('');
    const fd = new FormData();
    fd.append('data', JSON.stringify(values));
    fd.append('website', honeypot.current?.value || '');
    for (const [k, file] of Object.entries(files)) if (file) fd.append(k, file);
    try {
      setResult(await api.form('/public/admission/apply', fd));
    } catch (err) {
      setMessage(err.message);
      setErrors(err.details || {});
      const first = Object.keys(err.details || {})[0];
      if (first) document.getElementById(`f-${first}`)?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel" onSubmit={submit}>
      {form.intro && <div style={{ marginBottom: 20 }}><Alert kind="info">{form.intro}</Alert></div>}
      <div className="hp" aria-hidden="true"><label>Website<input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {form.sections.map((section) => {
        const fields = section.fields.filter(visible);
        if (!fields.length) return null;
        return (
          <fieldset key={section.id} className="form-section" style={{ border: 0, margin: 0, paddingInline: 0, borderTop: '1px solid var(--line)' }}>
            <h2>{section.title}</h2>
            <div className="form-grid">
              {fields.map((f) => (
                <Field
                  key={f.key}
                  field={f}
                  classes={classes}
                  maxMb={maxMb}
                  value={f.type === 'file' ? undefined : values[f.key]}
                  error={errors[f.key]}
                  onChange={(v) => (f.type === 'file' ? setFiles({ ...files, [f.key]: v }) : setValues({ ...values, [f.key]: v }))}
                />
              ))}
            </div>
          </fieldset>
        );
      })}
      {form.declaration && (
        <div className={`field ${errors.declaration ? 'has-err' : ''}`} style={{ marginBlock: 18 }}>
          <label className="check" style={{ fontWeight: 600 }}>
            <input type="checkbox" required checked={Boolean(values.declaration)} onChange={(e) => setValues({ ...values, declaration: e.target.checked })} /> {form.declaration}
          </label>
          {errors.declaration && <span className="err">{errors.declaration}</span>}
        </div>
      )}
      {message && <div style={{ marginBottom: 14 }}><Alert>{message}</Alert></div>}
      <button className="btn btn-primary" disabled={busy}>{t(busy ? 'Submitting...' : 'Submit application')}</button>
    </form>
  );
}

export default function Admission() {
  const { t } = useLang();
  const { loading, data, error } = useLoad('/public/admission/form');
  return (
    <>
      <PageHero
        title={data ? `${t('Admission')} ${data.session_year}` : t('Admission')}
        intro={data?.instructions || t('Apply online, then track your application with the application number.')}
      />
      <div className="inner" style={{ paddingTop: 12 }}><div className="narrow">
        <p style={{ marginBottom: 18 }}>{t('Already applied?')} <Link to="/admission/status" className="more-link">{t('Check your application status')}</Link></p>
        {loading && <Spinner />}
        {error && <p className="empty">{error.message}</p>}
        {data && !data.open && <Alert kind="info">{data.closed_message}</Alert>}
        {data && data.open && <ApplicationForm info={data} />}
      </div></div>
    </>
  );
}
