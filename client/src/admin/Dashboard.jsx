import React from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../lib/api.js';
import { Spinner, useLoad } from '../lib/ui.jsx';
import { PageHead } from './widgets.jsx';
import { useAdmin } from './AdminApp.jsx';

export default function Dashboard() {
  const { user, modules } = useAdmin();
  const { data, loading } = useLoad('/admin/dashboard');
  if (loading || !data) return <Spinner />;
  const on = (key) => modules.some((m) => m.key === key && m.enabled);
  const tiles = [
    on('notices') && { to: '/notices', value: data.notices, label: 'Published notices' },
    on('results') && { to: '/results', value: data.students, label: 'Active students' },
    on('results') && { to: '/results', value: data.exams, label: 'Published exams' },
    on('admission') && { to: '/admission', value: data.applications, label: 'New applications' },
    on('payments') && { to: '/payments', value: data.payments, label: 'Payments to verify' },
    on('media') && { to: '/media', value: data.media, label: 'Media files' },
    on('people') && { to: '/people', value: data.people, label: 'Teachers and staff' },
    on('events') && { to: '/events', value: data.events, label: 'Upcoming events' },
    on('feedback') && { to: '/feedback', value: data.feedback, label: 'New feedback' },
  ].filter(Boolean);
  return (
    <>
      <PageHead title={`Welcome, ${user.name.split(' ')[0]}`} intro="Here is what needs attention today." />
      <div className="tiles">
        {tiles.map((t) => <Link key={t.label} className="tile" to={t.to}><b>{t.value}</b><span>{t.label}</span></Link>)}
      </div>
      {data.recent.length > 0 && (
        <div className="box">
          <h2>Recent activity</h2>
          <div className="scroll">
            <table className="ad-table">
              <tbody>
                {data.recent.map((r, i) => <tr key={i}><td>{r.action}</td><td>{r.detail}</td><td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.created_at)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
