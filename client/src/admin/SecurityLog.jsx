import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { formatDateTime } from '../lib/api.js';
import { Alert, Pagination, Spinner, useLoad } from '../lib/ui.jsx';
import { PageHead } from './widgets.jsx';

export default function SecurityLog() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useLoad(`/admin/security/log?page=${page}`);
  return (
    <>
      <PageHead title="Security" intro="Every sign-in attempt and important change is recorded here.">
        <Link className="btn btn-ghost" to="/modules/security"><Settings size={15} /> Login and password rules</Link>
      </PageHead>
      {error && <Alert>{error.message}</Alert>}
      {loading && !data && <Spinner />}
      {data && (
        <>
          <div className="tiles"><div className="tile"><b>{data.activeLocks}</b><span>Login locks active now</span></div></div>
          <div className="scroll">
            <table className="ad-table">
              <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Detail</th><th>IP</th></tr></thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(l.created_at)}</td><td>{l.user_name || '-'}</td>
                    <td><span className={`badge ${/failed|blocked/.test(l.action) ? 'badge-bad' : ''}`}>{l.action}</span></td><td>{l.detail}</td><td>{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}
    </>
  );
}
