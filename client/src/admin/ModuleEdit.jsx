import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Alert, Spinner } from '../lib/ui.jsx';
import { PageHead, SchemaForm, useToast } from './widgets.jsx';
import { useAdmin } from './AdminApp.jsx';

export default function ModuleEdit({ onSaved }) {
  const { key } = useParams();
  const { user, refreshModules } = useAdmin();
  const toast = useToast();
  const [mod, setMod] = useState(null);
  const [content, setContent] = useState({});
  const [config, setConfig] = useState({});
  const [tab, setTab] = useState('content');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMod(null);
    setError('');
    api.get(`/admin/modules/${key}`)
      .then((m) => {
        setMod(m);
        setContent(m.content);
        setConfig(m.config);
        setTab(m.contentSchema ? 'content' : 'config');
      })
      .catch((e) => setError(e.message));
  }, [key]);

  if (error && !mod) return <Alert>{error}</Alert>;
  if (!mod) return <Spinner />;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (tab === 'content') {
        setContent(await api.put(`/admin/modules/${key}/content`, content));
      } else {
        await api.put(`/admin/modules/${key}/config`, config);
        const fresh = await api.get(`/admin/modules/${key}`);
        // The panel has moved, so this page's own address no longer exists.
        if (key === 'security' && fresh.config.admin_path !== mod.config.admin_path) {
          window.location.assign(`/${fresh.config.admin_path}/modules/security`);
          return;
        }
        setConfig(fresh.config);
      }
      await Promise.all([onSaved?.(), refreshModules()]);
      toast('Saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const hasConfig = user.role === 'admin' && mod.schema.length > 0;

  return (
    <>
      <PageHead title={mod.title} intro={mod.description}>
        {mod.adminPath && <Link className="btn btn-ghost" to={mod.adminPath}>Open {mod.title}</Link>}
      </PageHead>
      {mod.contentSchema && hasConfig && (
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'content'} onClick={() => setTab('content')}>Content</button>
          <button role="tab" aria-selected={tab === 'config'} onClick={() => setTab('config')}>Settings</button>
        </div>
      )}
      <div className="box">
        {tab === 'content' && mod.contentSchema && <SchemaForm fields={mod.contentSchema} value={content} onChange={setContent} />}
        {tab === 'config' && hasConfig && <SchemaForm fields={mod.schema} value={config} onChange={setConfig} ctx={{ classes: mod.classes }} />}
        {!mod.contentSchema && !hasConfig && <p className="empty">This module has nothing to configure here.</p>}
        {(mod.contentSchema || hasConfig) && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            {error && <Alert>{error}</Alert>}
            <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save changes'}</button>
          </div>
        )}
      </div>
    </>
  );
}
