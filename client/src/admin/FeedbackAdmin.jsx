import React, { useState } from 'react';
import { api, formatDateTime } from '../lib/api.js';
import { Alert, Pagination, Spinner, useLoad } from '../lib/ui.jsx';
import { ConfirmDelete, Modal, PageHead, useAction } from './widgets.jsx';

const BADGE = { new: 'badge-warn', read: 'badge-brand', closed: 'badge-good' };

export default function FeedbackAdmin() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const run = useAction();
  const { data, loading, error, reload } = useLoad(`/admin/feedback?page=${page}${status ? `&status=${status}` : ''}`);

  const update = (item, patch) => run(async () => {
    await api.put(`/admin/feedback/${item.id}`, { status: item.status, notes: item.notes, ...patch });
    reload();
  });

  const view = (item) => {
    setOpen(item);
    if (item.status === 'new') update(item, { status: 'read' });
  };

  return (
    <>
      <PageHead title="Feedback" intro="Messages sent with the feedback button on the website." />
      <div className="toolbar">
        <div className="field"><label htmlFor="fb-st">Status</label>
          <select id="fb-st" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All</option><option value="new">New</option><option value="read">Read</option><option value="closed">Closed</option>
          </select>
        </div>
      </div>
      {error && <Alert>{error.message}</Alert>}
      {loading && !data && <Spinner />}
      {data && (data.items.length === 0 ? <div className="box empty">No messages found.</div> : (
        <>
          <div className="scroll">
            <table className="ad-table">
              <thead><tr><th>From</th><th>Subject</th><th>Status</th><th>Date</th><th /></tr></thead>
              <tbody>
                {data.items.map((f) => (
                  <tr key={f.id}>
                    <td><strong>{f.name}</strong><br /><span className="help">{f.email || f.mobile || ''}</span></td>
                    <td>{f.subject || f.message.slice(0, 70)}</td>
                    <td><span className={`badge ${BADGE[f.status]}`} style={{ textTransform: 'capitalize' }}>{f.status}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(f.created_at)}</td>
                    <td className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => view(f)}>Open</button>
                      <ConfirmDelete message={`Delete the message from ${f.name}?`} onConfirm={() => run(async () => { await api.del(`/admin/feedback/${f.id}`); reload(); }, 'Deleted')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      ))}
      {open && (
        <Modal
          title={open.subject || `Message from ${open.name}`}
          onClose={() => setOpen(null)}
          footer={<>
            {open.email && <a className="btn btn-ghost" href={`mailto:${open.email}`}>Reply by email</a>}
            <button className="btn btn-primary" onClick={() => { update(open, { status: 'closed' }); setOpen(null); }}>Mark as closed</button>
          </>}
        >
          <div className="stack">
            <p style={{ fontSize: '.9rem', color: 'var(--muted)' }}>{open.name}{open.email ? `, ${open.email}` : ''}{open.mobile ? `, ${open.mobile}` : ''} · {formatDateTime(open.created_at)}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{open.message}</p>
            {open.page && <p style={{ fontSize: '.84rem', color: 'var(--muted)' }}>Sent from page: <code>{open.page}</code></p>}
          </div>
        </Modal>
      )}
    </>
  );
}
