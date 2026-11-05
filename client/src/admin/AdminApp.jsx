import React, { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Blocks, ExternalLink, LayoutDashboard, LogOut, Menu } from 'lucide-react';
import '../styles/admin.css';
import { api, asset } from '../lib/api.js';
import { useSite } from '../lib/site.jsx';
import { Spinner } from '../lib/ui.jsx';
import { ToastProvider } from './widgets.jsx';
import { Login, Setup } from './AuthPages.jsx';

const Dashboard = lazy(() => import('./Dashboard.jsx'));
const Modules = lazy(() => import('./Modules.jsx'));
const ModuleEdit = lazy(() => import('./ModuleEdit.jsx'));
const Collections = lazy(() => import('./Collections.jsx'));
const PeopleAdmin = lazy(() => import('./Collections.jsx').then((m) => ({ default: m.PeopleAdmin })));
const FeedbackAdmin = lazy(() => import('./FeedbackAdmin.jsx'));
const ResultsAdmin = lazy(() => import('./ResultsAdmin.jsx'));
const AdmissionAdmin = lazy(() => import('./AdmissionAdmin.jsx'));
const PaymentsAdmin = lazy(() => import('./PaymentsAdmin.jsx'));
const Users = lazy(() => import('./Users.jsx'));
const EmailAdmin = lazy(() => import('./EmailAdmin.jsx'));
const MediaLibrary = lazy(() => import('./MediaLibrary.jsx'));
const SecurityLog = lazy(() => import('./SecurityLog.jsx'));
const Profile = lazy(() => import('./Profile.jsx'));

const AdminContext = createContext(null);
export const useAdmin = () => useContext(AdminContext);

function Shell() {
  const { site, refresh: refreshSite } = useSite();
  const { user, logout, modules } = useAdmin();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const groups = {};
  for (const m of modules) {
    if (!m.enabled) continue;
    (groups[m.group] ||= []).push(m);
  }

  return (
    <div className="ad">
      {open && <div className="ad-scrim" onClick={() => setOpen(false)} />}
      <aside className={`ad-side ${open ? 'open' : ''}`}>
        <Link to="/" className="ad-brand">
          {site.logo && <img src={asset(site.logo)} alt="" />}
          <span>{site.short_name || site.school_name}</span>
        </Link>
        <nav className="ad-nav" aria-label="Admin">
          <NavLink end to="/"><LayoutDashboard size={16} /> Dashboard</NavLink>
          {user.role === 'admin' && <NavLink to="/modules" end><Blocks size={16} /> All Modules</NavLink>}
          {Object.entries(groups).map(([group, list]) => (
            <div key={group}>
              <h4>{group}</h4>
              {list.map((m) => <NavLink key={m.key} to={m.adminPath || `/modules/${m.key}`}>{m.title}</NavLink>)}
            </div>
          ))}
        </nav>
        <div className="ad-user">
          <Link to="/profile" style={{ minWidth: 0, color: 'inherit' }}><b>{user.name}</b><span className="help" style={{ textTransform: 'capitalize' }}>{user.role}</span></Link>
          <button className="icon-btn" aria-label="Sign out" title="Sign out" onClick={logout}><LogOut size={16} /></button>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <header className="ad-top">
          <button className="ad-menu" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={18} /></button>
          <span className="spacer" />
          <a className="btn btn-ghost btn-sm" href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> View site</a>
        </header>
        <main className="ad-main">
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="modules" element={<Modules />} />
              <Route path="modules/:key" element={<ModuleEdit onSaved={refreshSite} />} />
              <Route path="notices" element={<Collections kind="notices" />} />
              <Route path="achievements" element={<Collections kind="achievements" />} />
              <Route path="gallery" element={<Collections kind="gallery" />} />
              <Route path="facilities" element={<Collections kind="facilities" />} />
              <Route path="pages" element={<Collections kind="pages" />} />
              <Route path="history" element={<Collections kind="history" />} />
              <Route path="alumni" element={<Collections kind="alumni" />} />
              <Route path="people" element={<PeopleAdmin />} />
              <Route path="departments" element={<Collections kind="departments" />} />
              <Route path="events" element={<Collections kind="events" />} />
              <Route path="news" element={<Collections kind="news" />} />
              <Route path="publications" element={<Collections kind="publications" />} />
              <Route path="activities" element={<Collections kind="activities" />} />
              <Route path="feedback" element={<FeedbackAdmin />} />
              <Route path="results/*" element={<ResultsAdmin />} />
              <Route path="admission/*" element={<AdmissionAdmin />} />
              <Route path="payments" element={<PaymentsAdmin />} />
              <Route path="users" element={<Users />} />
              <Route path="email" element={<EmailAdmin />} />
              <Route path="media" element={<MediaLibrary />} />
              <Route path="security" element={<SecurityLog />} />
              <Route path="profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [state, setState] = useState({ loading: true, user: null, modules: [], setup: null });

  const refreshModules = useCallback(async () => {
    const { items } = await api.get('/admin/modules');
    setState((s) => ({ ...s, modules: items }));
  }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const setup = await api.get('/auth/setup-status');
      if (setup.needsSetup) return setState({ loading: false, user: null, modules: [], setup });
      const { user } = await api.get('/auth/me');
      const { items } = await api.get('/admin/modules');
      return setState({ loading: false, user, modules: items, setup });
    } catch {
      return setState({ loading: false, user: null, modules: [], setup: null });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logout = async () => {
    await api.post('/auth/logout');
    setState({ loading: false, user: null, modules: [], setup: null });
  };

  if (state.loading) return <Spinner />;

  return (
    <ToastProvider>
      {state.setup?.needsSetup ? <Setup keyConfigured={state.setup.keyConfigured} onDone={load} />
        : !state.user ? <Login onLogin={load} />
          : <AdminContext.Provider value={{ user: state.user, modules: state.modules, logout, refreshModules }}><Shell /></AdminContext.Provider>}
    </ToastProvider>
  );
}
