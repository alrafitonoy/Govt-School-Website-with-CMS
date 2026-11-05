import React, { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import '../styles/admin.css';
import { api, asset } from '../lib/api.js';
import { Spinner } from '../lib/ui.jsx';
import { Forgot, Login, Setup, TokenPage } from './AuthPages.jsx';

// The public sign-in page. The admin panel's private address is only learned after signing in.
async function goToPanel() {
  const { adminPath } = await api.get('/auth/me');
  if (import.meta.env.DEV) sessionStorage.setItem('adminBase', adminPath);
  window.location.assign(asset(adminPath));
}

function Entry() {
  const [setup, setSetup] = useState(null);
  useEffect(() => {
    api.get('/auth/setup-status').then(setSetup).catch(() => setSetup({ needsSetup: false }));
    goToPanel().catch(() => {});
  }, []);
  if (!setup) return <Spinner />;
  if (setup.needsSetup) return <Setup keyConfigured={setup.keyConfigured} onDone={goToPanel} />;
  return <Login onLogin={goToPanel} />;
}

export default function SignIn() {
  return (
    <Routes>
      <Route index element={<Entry />} />
      <Route path="forgot" element={<Forgot />} />
      <Route path="activate" element={<TokenPage />} />
      <Route path="reset" element={<TokenPage />} />
      <Route path="*" element={<Entry />} />
    </Routes>
  );
}
