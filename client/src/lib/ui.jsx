import React, { useEffect, useState } from 'react';
import { api } from './api.js';

export const Spinner = ({ label = 'Loading' }) => (
  <div className="spinner-wrap" role="status" aria-label={label}><span className="spinner" /></div>
);

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

// Loads data for a page and exposes loading, error and reload states.
export function useLoad(url, deps = []) {
  const [state, setState] = useState({ loading: Boolean(url), data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) {
      setState({ loading: false, data: null, error: null });
      return undefined;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.get(url)
      .then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => { alive = false; };
  }, [url, tick, ...deps]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function Html({ html, className = '' }) {
  // Rich text is sanitised on the server before it is saved.
  return <div className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: html || '' }} />;
}

export function Pagination({ page, total, limit, onPage }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pages">
      <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button className="btn btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}
