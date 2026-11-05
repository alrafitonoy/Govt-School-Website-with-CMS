import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLang } from '../lib/i18n.jsx';
import { Alert } from '../lib/ui.jsx';
import { PageHero } from './Info.jsx';

export default function PaymentResult() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const paid = params.get('status') === 'paid';
  return (
    <>
      <PageHero title={t(paid ? 'Payment successful' : 'Payment not completed')} />
      <div className="inner" style={{ paddingTop: 12 }}><div className="narrow">
        <Alert kind={paid ? 'success' : 'error'}>
          {paid ? `${t('Thank you. Your payment was received. Reference:')} ${params.get('ref') || ''}` : t('The payment was not confirmed. You can try again from the status page. If money was deducted, contact the school with your application number.')}
        </Alert>
        <p style={{ marginTop: 18 }}><Link className="btn btn-primary" to="/admission/status">{t('Application status')}</Link></p>
      </div></div>
    </>
  );
}
