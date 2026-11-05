import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Settings } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSite } from '../lib/site.jsx';
import { PageHead, Switch, useAction } from './widgets.jsx';
import { useAdmin } from './AdminApp.jsx';

export default function Modules() {
  const { modules, refreshModules } = useAdmin();
  const { refresh } = useSite();
  const run = useAction();

  const toggle = (m, enabled) => run(async () => {
    await api.put(`/admin/modules/${m.key}/state`, { enabled });
    await Promise.all([refreshModules(), refresh()]);
  }, `${m.title} ${enabled ? 'enabled' : 'disabled'}`);

  const move = (i, d) => run(async () => {
    const keys = modules.map((m) => m.key);
    [keys[i], keys[i + d]] = [keys[i + d], keys[i]];
    await api.put('/admin/modules-order', { keys });
    await Promise.all([refreshModules(), refresh()]);
  });

  return (
    <>
      <PageHead title="All Modules" intro="Turn features on or off and set them up. A disabled module disappears from the website and its pages stop working, but its data is kept. The order here also sets the order of the home page sections and the menu." />
      <div className="box" style={{ padding: 0 }}>
        {modules.map((m, i) => (
          <div className="module-row" key={m.key}>
            <div className="info">
              <b>{m.title}</b> {m.locked && <span className="badge">Core</span>}
              <p>{m.description}</p>
            </div>
            <div className="module-controls">
              <button className="icon-btn" aria-label={`Move ${m.title} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
              <button className="icon-btn" aria-label={`Move ${m.title} down`} disabled={i === modules.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
              <Link className="btn btn-ghost btn-sm" to={`/modules/${m.key}`}><Settings size={14} /> Configure</Link>
              <Switch checked={m.enabled} disabled={m.locked} onChange={(v) => toggle(m, v)} label={<span className="sr-only">Enable {m.title}</span>} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
