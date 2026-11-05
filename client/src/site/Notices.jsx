import React, { useState } from 'react';
import { useLang } from '../lib/i18n.jsx';
import { Spinner, Pagination, useLoad } from '../lib/ui.jsx';
import { PageHero } from './Info.jsx';
import { NoticeRow } from './sections.jsx';

export default function Notices() {
  const { t } = useLang();
  const [page, setPage] = useState(1);
  const { loading, data, error } = useLoad(`/public/notices?page=${page}`);
  return (
    <>
      <PageHero title={t('Noticeboard')} />
      <div className="inner" style={{ paddingTop: 12 }}>
        {loading && <Spinner />}
        {error && <p className="empty">{error.message}</p>}
        {data && !loading && (
          <>
            {data.items.length === 0 && <p className="empty">{t('There are no notices at the moment.')}</p>}
            <div className="notice-list">{data.items.map((n) => <NoticeRow key={n.id} notice={n} />)}</div>
            <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
}
