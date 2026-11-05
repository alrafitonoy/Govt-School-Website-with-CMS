import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, formatDateTime } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';
import { Alert } from '../lib/ui.jsx';
import { PageHero } from './Info.jsx';
import PaymentChooser from './PaymentChooser.jsx';

const STATUS = { submitted: 'Submitted', reviewing: 'Under review', accepted: 'Accepted', waitlisted: 'Waitlisted', rejected: 'Not accepted' };
const PAYMENT = { not_required: 'No fee', unpaid: 'Not paid', pending: 'Waiting for confirmation', paid: 'Paid' };

export default function AdmissionStatus() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const [appNo, setAppNo] = useState(params.get('app_no') || '');
  const [mobile, setMobile] = useState('');
  const [app, setApp] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const check = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      setApp(await api.post('/public/admission/status', { app_no: appNo, mobile }));
    } catch (err) {
      setApp(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero title={t('Application status')} />
      <div className="inner" style={{ paddingTop: 12 }}><div className="narrow">
        <form className="panel form-grid" onSubmit={check}>
          <div className="field">
            <label htmlFor="s-app">{t('Application number')}</label>
            <input id="s-app" required placeholder="ADM-2027-00001" value={appNo} onChange={(e) => setAppNo(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="s-mobile">{t('Contact mobile')}</label>
            <input id="s-mobile" required inputMode="tel" placeholder="01XXXXXXXXX" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <div className="span-full"><button className="btn btn-primary" disabled={busy}>{t(busy ? 'Checking...' : 'Check status')}</button></div>
          {error && <div className="span-full"><Alert>{error}</Alert></div>}
        </form>
        {app && (
          <div className="panel" style={{ marginTop: 20 }}>
            <div className="step-row"><span>{t('Student')}</span><span>{app.student_name}</span></div>
            <div className="step-row"><span>{t('Class')}</span><span>{app.class_name}, {t('Session')} {app.session_year}</span></div>
            <div className="step-row"><span>{t('Applied on')}</span><span>{formatDateTime(app.created_at)}</span></div>
            <div className="step-row"><span>{t('Status')}</span><span>{t(STATUS[app.status])}</span></div>
            <div className="step-row"><span>{t('Fee')}</span><span>{Number(app.fee_amount) > 0 ? `BDT ${Number(app.fee_amount)}, ${t(PAYMENT[app.payment_status])}` : t('No fee')}</span></div>
            {app.methods.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <PaymentChooser appNo={app.app_no} mobile={mobile} fee={Number(app.fee_amount)} methods={app.methods} onDone={() => check()} />
              </div>
            )}
          </div>
        )}
      </div></div>
    </>
  );
}
