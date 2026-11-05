import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, FileText, Film, Settings, Upload } from 'lucide-react';
import { api, asset } from '../lib/api.js';
import { Alert, Pagination, Spinner, useLoad } from '../lib/ui.jsx';
import { ConfirmDelete, DropZone, PageHead, useAction, useToast } from './widgets.jsx';
import { useAdmin } from './AdminApp.jsx';

const kb = (n) => (n > 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function MediaLibrary() {
  const { user } = useAdmin();
  const canDelete = user.role === 'admin' || user.permissions.includes('media.manage');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoad(`/admin/media?page=${page}`);
  const run = useAction();
  const toast = useToast();

  const upload = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    addFiles(files);
  };

  const addFiles = async (files) => {
    setBusy(true);
    let saved = 0;
    for (const file of files) {
      const purpose = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type === 'application/pdf' ? 'notice' : 'image';
      try {
        await api.upload(file, purpose);
        saved += 1;
      } catch (err) {
        toast(`${file.name}: ${err.message}`, true);
      }
    }
    setBusy(false);
    if (saved) toast(`${saved} file(s) uploaded`);
    reload();
  };

  const copy = async (url) => {
    await navigator.clipboard.writeText(new URL(asset(url), window.location.origin).href);
    toast('Link copied');
  };

  return (
    <>
      <PageHead title="Media Library" intro="Images are resized and converted to WebP when uploaded, so pages stay fast.">
        <span className="btn btn-primary file-btn"><Upload size={15} /> {busy ? 'Uploading...' : 'Upload'}<input type="file" multiple onChange={upload} disabled={busy} aria-label="Upload files" /></span>
        {user.role === 'admin' && <Link className="btn btn-ghost" to="/modules/media"><Settings size={15} /> Settings</Link>}
      </PageHead>
      {data && data.optimiser === false && <div style={{ marginBottom: 14 }}><Alert kind="warn">Image optimisation is not available on this server because the "sharp" module could not load. Uploads still work but are stored at full size.</Alert></div>}
      <DropZone onFiles={addFiles} disabled={busy} className="picker-drop" >
        <Upload size={20} aria-hidden="true" />
        <span>{busy ? 'Uploading...' : 'Drag files here to upload them'}</span>
      </DropZone>
      {error && <Alert>{error.message}</Alert>}
      {loading && !data && <Spinner />}
      {data && (data.items.length === 0 ? <div className="box empty">No files yet.</div> : (
        <>
          <div className="media-grid">
            {data.items.map((m) => (
              <div className="media-item" key={m.id}>
                <div className="thumb">
                  {m.kind === 'image' || m.kind === 'icon' ? <img src={asset(m.thumb_url || m.url)} alt="" loading="lazy" /> : m.kind === 'pdf' ? <FileText size={32} /> : <Film size={32} />}
                </div>
                <div className="meta">
                  <b title={m.original_name}>{m.original_name}</b>
                  {kb(m.size)}{m.original_size > m.size ? `, saved ${Math.round((1 - m.size / m.original_size) * 100)}%` : ''}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => copy(m.url)} aria-label="Copy link"><Copy size={13} /></button>
                    {canDelete && <ConfirmDelete message="Delete this file? Any page using it will show a broken link." onConfirm={() => run(async () => { await api.del(`/admin/media/${m.id}`); reload(); }, 'Deleted')} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      ))}
    </>
  );
}
