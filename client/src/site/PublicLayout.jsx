import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Accessibility, ChevronDown, ChevronUp, Globe, Home as HomeIcon, Mail, Menu, MessageCircle, Phone, X } from 'lucide-react';
import '../styles/site.css';
import { asset, formatDateTime } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';
import { useSite } from '../lib/site.jsx';

const initials = (name) => String(name || 'S').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// Menu items that point at a turned-off module are left out.
const MODULE_PATHS = {
  '/notices': 'notices', '/results': 'results', '/admission': 'admission', '/admission/status': 'admission', '/about': 'about', '/message': 'principal',
  '/achievements': 'achievements', '/facilities': 'facilities', '/gallery': 'gallery', '/contact': 'contact',
  '/officers': 'people', '/teachers': 'people', '/staff': 'people', '/information-officer': 'people', '/departments': 'departments',
  '/history': 'history', '/our-pride': 'alumni', '/events': 'events', '/news': 'news', '/publications': 'publications', '/activities': 'activities', '/feedback': 'feedback',
};

export function useLinkAllowed() {
  const { modules } = useSite();
  return (link) => {
    const key = MODULE_PATHS[String(link || '').split('?')[0]];
    return !key || Boolean(modules[key]);
  };
}

export function SmartLink({ link, children, ...rest }) {
  if (!link) return <span {...rest}>{children}</span>;
  if (/^https?:/i.test(link)) return <a href={link} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>;
  return <Link to={link} {...rest}>{children}</Link>;
}

function Banner() {
  const { site, banner } = useSite();
  const { lang, setLang, pick } = useLang();
  const style = banner.image ? { backgroundImage: `url("${asset(banner.image)}")` } : undefined;
  return (
    <div className="banner" style={style}>
      <Link to="/" aria-label={pick(site.school_name_bn, site.school_name)}>
        {site.logo ? <img className="banner-logo" src={asset(site.logo)} alt="" /> : <span className="banner-mark">{initials(site.short_name || site.school_name)}</span>}
      </Link>
      <button type="button" className="lang-switch" onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}>
        <Globe size={15} aria-hidden="true" /> {lang === 'bn' ? 'English' : 'বাংলা'}
      </button>
      <p className="banner-title"><Link to="/">{banner.title || pick(site.school_name_bn, site.school_name)}</Link></p>
    </div>
  );
}

function MegaMenu({ links }) {
  const { pick } = useLang();
  const columns = useMemo(() => {
    const map = new Map();
    for (const l of links) {
      const key = l.group || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(l);
    }
    return [...map];
  }, [links]);
  return (
    <div className="mega">
      {columns.map(([group, items]) => (
        <div className="mega-col" key={group}>
          {group && <h6>{group}</h6>}
          {items.map((l) => <SmartLink key={l.label} link={l.link}>{pick(l.label, l.label_en)}</SmartLink>)}
        </div>
      ))}
    </div>
  );
}

function MainMenu() {
  const { portal, nav } = useSite();
  const { t, pick } = useLang();
  const allowed = useLinkAllowed();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setOpen(false);
    setExpanded(null);
  }, [pathname]);

  const customPages = nav.filter((n) => n.key.startsWith('page:'));
  const items = (portal.menu || [])
    .map((m) => ({ ...m, links: (m.links || []).filter((l) => allowed(l.link)) }))
    .filter((m) => allowed(m.link));

  return (
    <nav className="menu-bar" aria-label={t('Home')} id="main-menu">
      <button type="button" className="menu-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <i><Menu size={20} /></i> {t('Select menu')}
      </button>
      <ul className={`menu-list ${open ? 'open' : ''}`}>
        <li className="menu-item">
          <Link className="menu-link menu-home" to="/" aria-label={t('Home')}><HomeIcon size={20} /></Link>
        </li>
        {items.map((m, i) => {
          const hasSub = m.links.length > 0;
          const label = pick(m.label, m.label_en);
          return (
            <li key={m.label} className={`menu-item ${expanded === i ? 'open' : ''}`}>
              {m.link ? <SmartLink className="menu-link" link={m.link}>{label}</SmartLink> : (
                <button type="button" className={`menu-link ${hasSub ? '' : 'static'}`} aria-expanded={hasSub ? expanded === i : undefined} onClick={() => setExpanded(expanded === i ? null : i)}>
                  {label} {hasSub && <ChevronDown size={14} aria-hidden="true" />}
                </button>
              )}
              {hasSub && <MegaMenu links={m.links} />}
            </li>
          );
        })}
        {customPages.map((p) => <li className="menu-item" key={p.key}><Link className="menu-link" to={p.path}>{p.label}</Link></li>)}
      </ul>
    </nav>
  );
}

const SKYLINE = (
  <svg className="footer-skyline" viewBox="0 0 1022 85" preserveAspectRatio="none" aria-hidden="true" fill="currentColor">
    <rect y="75" width="1022" height="10" />
    <path d="M35 75V60c-8-1-13-6-13-12 0-7 7-13 16-13s17 6 17 13c0 6-6 11-14 12v15zM75 75V50c-6-1-10-5-10-10 0-6 6-11 13-11s14 5 14 11c0 5-5 9-11 10v25zM105 75V66c-4 0-7-3-7-6 0-4 4-7 9-7s9 3 9 7c0 3-3 6-7 6v9z" opacity=".75" />
    <path d="M840 75V38h14V28h12v-8h6v8h26v-8h6v8h12v10h14v37zM930 75V44h24v31zM960 75V60c-6-1-9-4-9-8 0-5 5-9 11-9s12 4 12 9c0 4-4 7-9 8v15zM990 75V62c-4-1-6-3-6-6 0-4 4-7 8-7s8 3 8 7c0 3-2 5-6 6v13z" opacity=".78" />
    <path d="M160 40l6-3 5 3-5-1zM180 46l6-3 5 3-5-1zM500 30l5-3 5 3-5-1zM520 36l5-3 5 3-5-1z" opacity=".55" />
  </svg>
);

const DEVELOPER = { name: 'S.K.M. AL RAFI TONOY', occupation: 'Software Engineer, Cybersecurity Analyst, and IT Consultant', phone: '+880 1717-151255', digits: '8801717151255', email: 'alrafitonoy@gmail.com' };

function DeveloperPopup({ onClose }) {
  const close = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    close.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="dev-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dev-popup" role="dialog" aria-modal="true" aria-labelledby="dev-title">
        <button type="button" ref={close} className="dev-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        <h2 id="dev-title">Developer Details</h2>
        <dl>
          <dt>Name</dt><dd>{DEVELOPER.name}</dd>
          <dt>Occupation</dt><dd>{DEVELOPER.occupation}</dd>
          <dt>Phone</dt><dd><a href={`tel:+${DEVELOPER.digits}`}><Phone size={14} aria-hidden="true" /> {DEVELOPER.phone}</a></dd>
          <dt>WhatsApp</dt><dd><a href={`https://wa.me/${DEVELOPER.digits}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} aria-hidden="true" /> {DEVELOPER.phone}</a></dd>
          <dt>Email</dt><dd><a href={`mailto:${DEVELOPER.email}`}><Mail size={14} aria-hidden="true" /> {DEVELOPER.email}</a></dd>
        </dl>
      </div>
    </div>
  );
}

function Footer() {
  const [showDeveloper, setShowDeveloper] = useState(false);
  const { site, lastUpdated } = useSite();
  const { lang, t } = useLang();
  const when = lastUpdated && lang === 'bn'
    ? new Date(`${String(lastUpdated).replace(' ', 'T')}Z`).toLocaleString('bn-BD', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Asia/Dhaka' })
    : formatDateTime(lastUpdated);
  return (
    <footer className="portal-footer">
      {SKYLINE}
      <div className="footer-note">{t('Everything published on this website is kept up to date by the school.')}</div>
      <div className="footer-row">
        <div>
          {when && <>{t('Site last updated:')} {when}</>}
          {site.footer_text && <small>{site.footer_text}</small>}
        </div>
        <div className="footer-links">
          {site.phone && <a href={`tel:${site.phone.replace(/[^+\d]/g, '')}`}>{site.phone}</a>}
          {site.email && <a href={`mailto:${site.email}`}>{site.email}</a>}
          <Link to="/signin">{t('Sign in')}</Link>
        </div>
      </div>
      <div className="footer-credit">
        <button type="button" onClick={() => setShowDeveloper(true)}>Developed by: {DEVELOPER.name}</button>
      </div>
      {showDeveloper && <DeveloperPopup onClose={() => setShowDeveloper(false)} />}
    </footer>
  );
}

const A11Y_KEY = 'site-a11y';
const readA11y = () => {
  try {
    return { zoom: 100, contrast: false, gray: false, underline: false, ...JSON.parse(localStorage.getItem(A11Y_KEY) || '{}') };
  } catch {
    return { zoom: 100, contrast: false, gray: false, underline: false };
  }
};

function FloatingButtons() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(readA11y);

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = a.zoom === 100 ? '' : `${a.zoom}%`;
    document.querySelector('.portal-page')?.style.setProperty('zoom', a.zoom === 100 ? '' : a.zoom / 100);
    root.classList.toggle('a11y-contrast', a.contrast);
    root.classList.toggle('a11y-gray', a.gray);
    root.classList.toggle('a11y-underline', a.underline);
    try {
      localStorage.setItem(A11Y_KEY, JSON.stringify(a));
    } catch {
      /* the choice just will not be remembered */
    }
  }, [a]);

  const zoom = (d) => setA({ ...a, zoom: Math.min(130, Math.max(90, a.zoom + d)) });

  return (
    <>
      <button type="button" className="fab fab-a11y" aria-label={t('Accessibility')} aria-expanded={open} onClick={() => setOpen(!open)}><Accessibility size={24} /></button>
      {open && (
        <div className="a11y-panel" role="dialog" aria-label={t('Accessibility')}>
          <h3>{t('Accessibility')}</h3>
          <button type="button" onClick={() => zoom(10)}>{t('Larger text')}</button>
          <button type="button" onClick={() => zoom(-10)}>{t('Smaller text')}</button>
          <button type="button" aria-pressed={a.contrast} onClick={() => setA({ ...a, contrast: !a.contrast })}>{t('High contrast')}</button>
          <button type="button" aria-pressed={a.gray} onClick={() => setA({ ...a, gray: !a.gray })}>{t('Grayscale')}</button>
          <button type="button" aria-pressed={a.underline} onClick={() => setA({ ...a, underline: !a.underline })}>{t('Underline links')}</button>
          <button type="button" onClick={() => setA({ zoom: 100, contrast: false, gray: false, underline: false })}>{t('Reset')}</button>
          <button type="button" onClick={() => setOpen(false)}>{t('Close')}</button>
        </div>
      )}
      <button type="button" className="fab fab-top" aria-label={t('Back to top')} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ChevronUp size={26} /></button>
    </>
  );
}

export default function PublicLayout() {
  const { portal } = useSite();
  const { t } = useLang();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.add('portal-body');
    document.body.style.backgroundImage = portal.background ? `url("${asset(portal.background)}")` : '';
    return () => {
      document.body.classList.remove('portal-body');
      document.body.style.backgroundImage = '';
    };
  }, [portal.background]);

  return (
    <div className="portal-page">
      <a className="skip-link" href="#main-content">{t('Skip to content')}</a>
      <header>
        <Banner />
        <MainMenu />
      </header>
      <main className="portal-main" id="main-content"><Outlet /></main>
      <Footer />
      <FloatingButtons />
    </div>
  );
}
