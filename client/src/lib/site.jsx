import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, asset } from './api.js';
import { Spinner } from './ui.jsx';

const SiteContext = createContext(null);

function readInjected() {
  try {
    return JSON.parse(document.getElementById('boot-data')?.textContent || 'null');
  } catch {
    return null;
  }
}

function applyBrand(site) {
  if (site?.brand_color) document.documentElement.style.setProperty('--brand', site.brand_color);
  if (site?.secondary_color) document.documentElement.style.setProperty('--brand-2', site.secondary_color);
  if (site?.favicon) {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== asset(site.favicon)) link.setAttribute('href', asset(site.favicon));
  }
}

// The server embeds site data in the page, so the first paint needs no extra request.
export function SiteProvider({ children }) {
  const [boot, setBoot] = useState(readInjected);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => api.get('/public/boot?ts=' + Date.now()).then(setBoot).catch(setError), []);

  useEffect(() => {
    if (!boot) refresh();
  }, [boot, refresh]);

  useEffect(() => applyBrand(boot?.site), [boot]);

  if (error && !boot) return <div className="boot-error">{error.message}</div>;
  if (!boot) return <Spinner />;
  return <SiteContext.Provider value={{ ...boot, refresh }}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);

export function usePageTitle(title) {
  const { site } = useSite();
  useEffect(() => {
    if (title) document.title = `${title} | ${site.school_name}`;
    else if (title === null) document.title = site.school_name;
  }, [title, site.school_name]);
}
