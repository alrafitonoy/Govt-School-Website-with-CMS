import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';
import { Alert } from '../lib/ui.jsx';

// Lets the applicant choose from the methods the admin has turned on.
export default function PaymentChooser({ appNo, mobile, fee, methods, onDone }) {
  const { t } = useLang();
  const [method, setMethod] = useState(null);
  const [payerRef, setPayerRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!methods.length) return <Alert kind="info">{t('Please contact the school office to pay the fee of')} BDT {fee}.</Alert>;

  const chosen = methods.find((m) => m.key === method);
  const needsRef = chosen && ['manual', 'offline-ref'].includes(chosen.mode);

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/public/payments/start', { app_no: appNo, mobile, method, payer_ref: payerRef });
      if (res.redirect) {
        window.location.assign(res.redirect);
        return;
      }
      onDone(chosen, res);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div>
      <h3 style={{ fontSize: '1.08rem', marginBottom: 12 }}>{t('Pay the application fee:')} BDT {fee}</h3>
      <div className="method-list" role="radiogroup" aria-label="Payment method">
        {methods.map((m) => (
          <label key={m.key} className={`method ${method === m.key ? 'selected' : ''}`}>
            <span className="check">
              <input type="radio" name="method" value={m.key} checked={method === m.key} onChange={() => setMethod(m.key)} />
              <span>
                <b>{m.label}</b>
                {m.number && <small>{t('Send to:')} <strong>{m.number}</strong></small>}
                {m.hint && <small>{m.hint}</small>}
              </span>
            </span>
          </label>
        ))}
      </div>
      {needsRef && (
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="pay-ref">{t(chosen.mode === 'manual' ? 'Transaction ID' : 'Deposit slip or reference number')} <span className="req">*</span></label>
          <input id="pay-ref" value={payerRef} onChange={(e) => setPayerRef(e.target.value)} maxLength={120} />
        </div>
      )}
      {error && <div style={{ marginTop: 12 }}><Alert>{error}</Alert></div>}
      <p style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" disabled={!method || busy} onClick={pay}>
          {t(busy ? 'Please wait...' : chosen?.mode === 'online' ? 'Continue to payment' : 'Confirm')}
        </button>
      </p>
    </div>
  );
}
