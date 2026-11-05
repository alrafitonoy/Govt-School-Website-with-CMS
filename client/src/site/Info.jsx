import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Clock, Facebook, Linkedin, Link2, Mail, MapPin, MessageCircle, Phone, Twitter } from 'lucide-react';
import { asset } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';
import { useSite, usePageTitle } from '../lib/site.jsx';
import { Html, Spinner, useLoad } from '../lib/ui.jsx';
import { AchievementCards, FacilityTile, GalleryGrid, Portrait } from './sections.jsx';

function ShareRow() {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const url = encodeURIComponent(window.location.href);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* some browsers block clipboard access */
    }
  };
  return (
    <div className="share-row">
      <div>
        <p>{t('Click to share this content')}</p>
        <div className="share-icons">
          <a aria-label="Facebook" target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${url}`}><Facebook size={15} /></a>
          <a aria-label="X" target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?url=${url}`}><Twitter size={15} /></a>
          <a aria-label="WhatsApp" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${url}`}><MessageCircle size={15} /></a>
          <a aria-label="LinkedIn" target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${url}`}><Linkedin size={15} /></a>
          <button type="button" className={copied ? 'copied' : ''} aria-label={t('Copy link')} title={t('Copy link')} onClick={copy}><Link2 size={15} /></button>
        </div>
      </div>
    </div>
  );
}

export function PageHero({ title, intro }) {
  usePageTitle(title);
  return (
    <div className="inner" style={{ paddingBottom: 0 }}>
      <ShareRow />
      <h1 className="inner-title">{title}</h1>
      {intro && <p className="inner-intro">{intro}</p>}
    </div>
  );
}

const Body = ({ children }) => <div className="inner" style={{ paddingTop: 12 }}>{children}</div>;

function Loader({ url, children }) {
  const { loading, data, error } = useLoad(url);
  if (loading) return <Spinner />;
  if (error) return <Body><p className="empty">{error.message}</p></Body>;
  return children(data);
}

function Message() {
  const { t } = useLang();
  return (
    <Loader url="/public/content/principal">
      {(c) => (
        <>
          <PageHero title={c.heading} />
          <Body>
            <div className="split">
              <div>
                <Portrait src={c.photo} />
                {c.name && <p className="signature">{c.name}<span>{c.designation}</span></p>}
              </div>
              {c.message ? <Html html={c.message} /> : <p className="empty">{t('Nothing has been added here yet.')}</p>}
            </div>
          </Body>
        </>
      )}
    </Loader>
  );
}

function About() {
  const { t } = useLang();
  const { modules } = useSite();
  return (
    <Loader url="/public/content/about">
      {(c) => (
        <>
          <PageHero title={c.heading} intro={c.summary} />
          <Body>
            {c.image && <img src={asset(c.image)} alt="" style={{ width: '100%', marginBottom: 20 }} />}
            <Html html={c.body} />
            {(c.mission || c.vision) && (
              <div className="mv">
                {c.mission && <div><b>{t('Mission')}</b>{c.mission}</div>}
                {c.vision && <div><b>{t('Vision')}</b>{c.vision}</div>}
              </div>
            )}
            <div className="about-links">
              {modules.history && <Link className="grad-btn" to="/history">{t('History')}</Link>}
              {modules.alumni && <Link className="grad-btn" to="/our-pride">{t('Our Pride')}</Link>}
            </div>
          </Body>
        </>
      )}
    </Loader>
  );
}

function Achievements() {
  const { t } = useLang();
  return (
    <>
      <PageHero title={t('Achievements')} />
      <Loader url="/public/achievements">
        {({ items }) => <Body>{items.length ? <AchievementCards items={items} /> : <p className="empty">{t('Nothing has been added here yet.')}</p>}</Body>}
      </Loader>
    </>
  );
}

function GalleryView({ items }) {
  const { t } = useLang();
  const albums = useMemo(() => [...new Set(items.map((g) => g.album).filter(Boolean))], [items]);
  const [album, setAlbum] = useState(null);
  const shown = album ? items.filter((g) => g.album === album) : items;
  if (!items.length) return <p className="empty">{t('Nothing has been added here yet.')}</p>;
  return (
    <>
      {albums.length > 1 && (
        <div className="filter-row">
          <button aria-pressed={!album} onClick={() => setAlbum(null)}>{t('All')}</button>
          {albums.map((a) => <button key={a} aria-pressed={album === a} onClick={() => setAlbum(a)}>{a}</button>)}
        </div>
      )}
      <GalleryGrid items={shown} />
    </>
  );
}

function Gallery() {
  const { t } = useLang();
  return (
    <>
      <PageHero title={t('Media & Gallery')} />
      <Loader url="/public/gallery">{({ items }) => <Body><GalleryView items={items} /></Body>}</Loader>
    </>
  );
}

function Facilities() {
  const { t } = useLang();
  return (
    <>
      <PageHero title={t('Facilities')} />
      <Loader url="/public/facilities">
        {({ items }) => {
          const groups = new Map();
          items.forEach((f) => groups.set(f.category || t('Other'), [...(groups.get(f.category || t('Other')) || []), f]));
          return (
            <Body>
              {!items.length && <p className="empty">{t('Nothing has been added here yet.')}</p>}
              {[...groups].map(([name, list]) => (
                <div className="fac-group" key={name}>
                  <h3>{name}</h3>
                  <div className="fac-grid">{list.map((f) => <FacilityTile key={f.id} item={f} />)}</div>
                </div>
              ))}
            </Body>
          );
        }}
      </Loader>
    </>
  );
}

function Contact() {
  const { site } = useSite();
  const { t } = useLang();
  return (
    <Loader url="/public/content/contact">
      {(c) => (
        <>
          <PageHero title={c.heading} intro={c.intro} />
          <Body>
            <div className="contact-grid">
              <div className="panel">
                {site.address && <div className="contact-item"><MapPin size={20} /><div><b>{t('Address')}</b>{site.address}</div></div>}
                {site.phone && <div className="contact-item"><Phone size={20} /><div><b>{t('Phone')}</b><a href={`tel:${site.phone.replace(/[^+\d]/g, '')}`}>{site.phone}</a></div></div>}
                {site.email && <div className="contact-item"><Mail size={20} /><div><b>{t('Email')}</b><a href={`mailto:${site.email}`}>{site.email}</a></div></div>}
                {site.office_hours && <div className="contact-item"><Clock size={20} /><div><b>{t('Office hours')}</b>{site.office_hours}</div></div>}
              </div>
              {site.map_embed && <iframe className="map" src={site.map_embed} title="Map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
            </div>
          </Body>
        </>
      )}
    </Loader>
  );
}

function Custom() {
  const { slug } = useParams();
  return (
    <Loader url={`/public/pages/${encodeURIComponent(slug)}`}>
      {(p) => (
        <>
          <PageHero title={p.title} />
          <Body><Html html={p.body} /></Body>
        </>
      )}
    </Loader>
  );
}

function SearchPage() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const term = params.get('q') || '';
  const { data, loading } = useLoad(term.trim().length >= 2 ? `/public/search?q=${encodeURIComponent(term)}` : null);
  return (
    <>
      <PageHero title={t('Search results')} intro={term} />
      <Body>
        {term.trim().length < 2 && <p className="empty">{t('Enter at least two letters.')}</p>}
        {loading && <Spinner />}
        {data && !loading && data.items.length === 0 && <p className="empty">{t('No results found.')}</p>}
        {data && !loading && data.items.length > 0 && (
          <ul className="search-results">{data.items.map((r) => <li key={`${r.kind}${r.path}${r.title}`}><Link to={r.path}>{r.title}</Link></li>)}</ul>
        )}
      </Body>
    </>
  );
}

function NotFound() {
  const { t } = useLang();
  return (
    <>
      <PageHero title={t('Page not found')} intro={t('This page does not exist or has been turned off.')} />
      <Body><Link className="grad-btn" to="/">{t('Back to home')}</Link></Body>
    </>
  );
}

const PAGES = { message: Message, about: About, achievements: Achievements, gallery: Gallery, facilities: Facilities, contact: Contact, custom: Custom, search: SearchPage, notfound: NotFound };

export default function Info({ page }) {
  const Page = PAGES[page] || NotFound;
  return <Page />;
}
