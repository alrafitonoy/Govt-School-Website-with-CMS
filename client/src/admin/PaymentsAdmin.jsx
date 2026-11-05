import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { api, formatDateTime } from '../lib/api.js';
import { Alert, Pagination, Spinner, useLoad } from '../lib/ui.jsx';
import { Modal, PageHead, useAction, useToast } from './widgets.jsx';
import { useAdmin } from './AdminApp.jsx';

const badge = { paid: 'badge-good', awaiting_verification: 'badge-warn', pending: 'badge-warn', failed: 'badge-bad', cancelled: '' };
const label = { paid: 'Paid', awaiting_verification: 'To verify', pending: 'Pending', failed: 'Failed', cancelled: 'Cancelled' };

export default function PaymentsAdmin() {
  const { user } = useAdmin();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [record, setRecord] = useState(null);
  const run = useAction();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(`/admin/payments?page=${page}${status ? `&status=${status}` : ''}`);

  const act = (p, verb, message) => {
    const prompt = verb === 'verify' ? `Confirm that ${p.currency} ${Number(p.amount)} from ${p.student_name} has been received?` : `Reject this payment from ${p.student_name}?`;
    if (window.confirm(prompt)) run(async () => { await api.post(`/admin/payments/${p.id}/${verb}`); reload(); }, message);
  };

  const saveRecord = async () => {
    try {
      await api.post('/admin/payments/record-offline', record);
      toast('Payment recorded');
      setRecord(null);
      reload();
    } catch (err) {
      toast(err.message, true);
    }
  };

  return (
    <>
      <PageHead title="Payments" intro="Verify manual payments and record money received at the office.">
        <button className="btn btn-primary" onClick={() => setRecord({ app_no: '', receipt: '' })}>Record office payment</button>
        {user.role === 'admin' && <Link className="btn btn-ghost" to="/modules/payments"><Settings size={15} /> Payment settings</Link>}
      </PageHead>
      <div className="toolbar">
        <div className="field"><label htmlFor="p-st">Status</label>
          <select id="p-st" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All</option>
            {Object.entries(label).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      {error && <Alert>{error.message}</Alert>}
      {loading && !data && <Spinner />}
      {data && (data.items.length === 0 ? <div className="box empty">No payments found.</div> : (
        <>
          <div className="scroll">
            <table className="ad-table">
              <thead><tr><th>Application</th><th>Student</th><th>Method</th><th>Amount</th><th>Reference</th><th>Status</th><th>Date</th><th /></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: 'nowrap' }}><strong>{p.app_no}</strong></td><td>{p.student_name}<br /><span className="help">{p.mobile}</span></td>
                    <td style={{ textTransform: 'capitalize' }}>{p.method}</td><td style={{ whiteSpace: 'nowrap' }}>{p.currency} {Number(p.amount)}</td><td>{p.payer_ref || '-'}</td>
                    <td><span className={`badge ${badge[p.status]}`}>{label[p.status]}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(p.paid_at || p.created_at)}</td>
                    <td className="actions">
                      {['awaiting_verification', 'pending'].includes(p.status) && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => act(p, 'verify', 'Marked as paid')}>Mark paid</button>
                          <button className="btn btn-danger btn-sm" onClick={() => act(p, 'reject', 'Payment rejected')}>Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      ))}
      {record && (
        <Modal title="Record office payment" onClose={() => setRecord(null)} footer={<><button className="btn btn-ghost" onClick={() => setRecord(null)}>Cancel</button><button className="btn btn-primary" disabled={!record.app_no.trim()} onClick={saveRecord}>Record</button></>}>
          <div className="stack">
            <div className="field"><label htmlFor="rec-a">Application number</label><input id="rec-a" value={record.app_no} onChange={(e) => setRecord({ ...record, app_no: e.target.value })} /></div>
            <div className="field"><label htmlFor="rec-r">Receipt number (optional)</label><input id="rec-r" value={record.receipt} onChange={(e) => setRecord({ ...record, receipt: e.target.value })} /></div>
          </div>
        </Modal>
      )}
    </>
  );
}
