import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { asset, formatDate } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';
import { Html, Spinner, useLoad } from '../lib/ui.jsx';
import { PageHero } from './Info.jsx';

export default function NoticeDetail() {
  const { t } = useLang();
  const { id } = useParams();
  const { loading, data, error } = useLoad(`/public/notices/${encodeURIComponent(id)}`);
  if (loading) return <Spinner />;
  if (error) {
    return (
      <>
        <PageHero title={t('Notice not found')} intro={error.message} />
        <div className="inner"><Link className="grad-btn" to="/notices">{t('All notices')}</Link></div>
      </>
    );
  }
  return (
    <>
      <PageHero title={data.title} intro={[data.category, formatDate(data.notice_date)].filter(Boolean).join(' · ')} />
      <div className="inner" style={{ paddingTop: 12 }}>
        <Html html={data.body} />
        {data.attachments.length > 0 && (
          <div className="attachments">
            {data.attachments.map((a) => (a.kind === 'pdf' ? (
              <div key={a.url}>
                <div className="pdf-card">
                  <span><FileText size={18} aria-hidden="true" /> {a.name || t('PDF document')}</span>
                  <a className="btn btn-ghost btn-sm" href={asset(a.url)} target="_blank" rel="noopener noreferrer"><Download size={15} /> {t('Open PDF')}</a>
                </div>
                <iframe className="pdf-frame" style={{ marginTop: 10 }} src={asset(a.url)} title={a.name || 'PDF document'} loading="lazy" />
              </div>
            ) : (
              <a key={a.url} href={asset(a.url)} target="_blank" rel="noopener noreferrer"><img src={asset(a.url)} alt={a.name || 'Notice attachment'} loading="lazy" /></a>
            )))}
          </div>
        )}
        <p style={{ marginTop: 32 }}><Link className="more-link" to="/notices"><ArrowLeft size={16} /> {t('All notices')}</Link></p>
      </div>
    </>
  );
}
