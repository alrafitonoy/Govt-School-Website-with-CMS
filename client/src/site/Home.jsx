import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, CircleCheck, FileText, Image as ImageIcon, Play } from 'lucide-react';
import { asset, formatDate } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';
import { useSite, usePageTitle } from '../lib/site.jsx';
import { Spinner, useLoad } from '../lib/ui.jsx';
import { SmartLink, useLinkAllowed } from './PublicLayout.jsx';
import { GalleryGrid, Portrait } from './sections.jsx';

const NewsLink = ({ n }) => (n.external_link
  ? <a href={n.external_link} target="_blank" rel="noopener noreferrer">{n.title}</a>
  : <Link to={n.news_date ? `/news/${n.id}` : `/notices/${n.id}`}>{n.title}</Link>);

function NoticeCard({ items, news }) {
  const { t } = useLang();
  // The strip falls back to notices, so it is never empty while there is something to show.
  const strip = news.length > 0 ? news : items;
  return (
    <section className="notice-card">
      <div className="notice-card-head"><FileText size={24} aria-hidden="true" /><h2>{t('Noticeboard')}</h2></div>
      {items.length > 0 ? (
        <ul className="notice-items">
          {items.map((n) => <li key={n.id}><Link to={`/notices/${n.id}`}>{n.title}</Link><time dateTime={n.notice_date}>{formatDate(n.notice_date)}</time></li>)}
        </ul>
      ) : <p className="placeholder-note" style={{ paddingBlock: 18 }}>{t('There are no notices at the moment.')}</p>}
      <div className="news-strip">
        <span className="news-label">{t('News')}</span>
        <div className="news-track">
          {strip.length > 0 && <span>{strip.map((n) => <NewsLink key={n.id} n={n} />)}</span>}
        </div>
        <Link className="grad-btn" to="/notices">{t('View archive')}</Link>
      </div>
    </section>
  );
}

const plainText = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const shorten = (text, max = 320) => (text.length > max ? `${text.slice(0, max).trim()}...` : text);

function HeadMessage({ c }) {
  const { t } = useLang();
  const text = c.excerpt || shorten(plainText(c.message));
  if (!text && !c.name) return null;
  return (
    <section className="block">
      <h2 className="block-title">{t(c.heading || 'Message from the Head Teacher')}</h2>
      <div className="home-feature">
        <div className="home-feature-photo"><Portrait src={c.photo} /></div>
        <div className="home-feature-body">
          {text && <p>{text}</p>}
          {c.name && <p className="signature">{c.name}<span>{c.designation}</span></p>}
          {c.message && <Link className="grad-btn" to="/message">{t('Read the full message')}</Link>}
        </div>
      </div>
    </section>
  );
}

function AboutSchool({ c }) {
  const { t } = useLang();
  const text = c.summary || shorten(plainText(c.body));
  if (!text && !c.mission && !c.vision) return null;
  return (
    <section className="block">
      <h2 className="block-title">{t(c.heading || 'About the School')}</h2>
      <div className="home-feature">
        {c.image && <div className="home-feature-photo wide"><img src={asset(c.image)} alt="" loading="lazy" /></div>}
        <div className="home-feature-body">
          {text && <p>{text}</p>}
          {(c.mission || c.vision) && (
            <div className="home-mv">
              {c.mission && <div><b>{t('Mission')}</b>{c.mission}</div>}
              {c.vision && <div><b>{t('Vision')}</b>{c.vision}</div>}
            </div>
          )}
          <Link className="grad-btn" to="/about">{t('Read more')}</Link>
        </div>
      </div>
    </section>
  );
}

function HistoryHighlight({ section }) {
  const { t } = useLang();
  const c = section.content;
  const photos = section.items || [];
  if (!c.summary && !c.body && photos.length === 0) return null;
  return (
    <section className="block">
      <h2 className="block-title">{t(c.heading || 'History')}</h2>
      <div className="history-highlight">
        {(c.summary || c.body) && <p>{c.summary || shorten(plainText(c.body))}</p>}
        {photos.length > 0 && <GalleryGrid items={photos} className="photo-grid" />}
        <Link className="grad-btn" to="/history">{t('View full history')}</Link>
      </div>
    </section>
  );
}

function ServiceBoxes({ boxes }) {
  const { pick } = useLang();
  const allowed = useLinkAllowed();
  if (!boxes.length) return null;
  return (
    <div className="service-grid">
      {boxes.map((b) => (
        <article className="service-box" key={b.title || b.title_en}>
          <div className="service-box-head">
            <span className="service-icon">{b.image ? <img src={asset(b.image)} alt="" loading="lazy" /> : <ImageIcon size={26} aria-hidden="true" />}</span>
            <h3>{pick(b.title, b.title_en)}</h3>
          </div>
          <ul>
            {(b.links || []).filter((l) => allowed(l.link)).map((l) => <li key={l.label}><SmartLink link={l.link}>{pick(l.label, l.label_en)}</SmartLink></li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

const youtubeId = (url) => String(url || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/)?.[1];

function VideoMap({ videoUrl, mapUrl }) {
  const { t } = useLang();
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(videoUrl);
  if (!id && !mapUrl) return null;
  return (
    <section className="block">
      <h2 className="block-title">{t('Video and map')}</h2>
      <div className="video-map">
        {id && (
          <div className="frame">
            {playing
              ? <iframe className="video-frame" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={t('Video and map')} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
              : <button type="button" className="video-thumb" aria-label="Play" onClick={() => setPlaying(true)}><img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" /><Play aria-hidden="true" /></button>}
          </div>
        )}
        {mapUrl && <div className="frame"><iframe src={mapUrl} title={t('Video and map')} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>}
      </div>
    </section>
  );
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function Calendar({ title }) {
  const { t } = useLang();
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const label = new Date(view.y, view.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const prefix = `${view.y}-${String(view.m + 1).padStart(2, '0')}`;
  const { data: monthEvents } = useLoad(`/public/events?month=${prefix}`);
  const eventDays = useMemo(() => {
    const days = new Set();
    for (const e of monthEvents?.items || []) {
      const start = new Date(`${e.starts_on}T00:00:00Z`);
      const end = new Date(`${e.ends_on || e.starts_on}T00:00:00Z`);
      for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
        const iso = d.toISOString().slice(0, 10);
        if (iso.startsWith(prefix)) days.add(Number(iso.slice(8)));
      }
    }
    return days;
  }, [monthEvents, prefix]);
  const weeks = useMemo(() => {
    const first = new Date(view.y, view.m, 1).getDay();
    const total = new Date(view.y, view.m + 1, 0).getDate();
    const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  }, [view]);
  const shift = (d) => setView(({ y, m }) => {
    const next = new Date(y, m + d, 1);
    return { y: next.getFullYear(), m: next.getMonth() };
  });
  const isToday = (d) => d === now.getDate() && view.m === now.getMonth() && view.y === now.getFullYear();
  return (
    <section className="block">
      <h2 className="block-title">{title}</h2>
      <div className="calendar">
        <div className="calendar-head">
          <button type="button" aria-label={t('Previous')} onClick={() => shift(-1)}><ArrowLeft size={13} /></button>
          <span aria-live="polite">{label}</span>
          <button type="button" aria-label={t('Next')} onClick={() => shift(1)}><ArrowRight size={13} /></button>
        </div>
        <table>
          <thead><tr>{DAYS.map((d) => <th key={d} scope="col">{d}</th>)}</tr></thead>
          <tbody>
            {weeks.map((w, i) => (
              <tr key={i}>
                {w.map((d, n) => (
                  <td key={n} className={!d ? 'blank' : `${isToday(d) ? 'today' : ''} ${eventDays.has(d) ? 'has-event' : ''}`} aria-current={d && isToday(d) ? 'date' : undefined}>
                    {d && eventDays.has(d) ? <Link to={`/events?date=${prefix}-${String(d).padStart(2, '0')}`}>{d}</Link> : d}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link className="calendar-all" to="/events">{t('All')}</Link>
    </section>
  );
}

function Hotlines({ items }) {
  const { t, pick } = useLang();
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, 3);
  return (
    <section className="block">
      <h2 className="block-title">{t('Emergency contacts')}</h2>
      {shown.map((h) => <div className="hotline" key={h.number}><span>{pick(h.label, h.label_en)}</span><strong>{h.number}</strong></div>)}
      {items.length > 3 && (
        <button type="button" className="outline-btn" aria-expanded={all} onClick={() => setAll(!all)}>
          {t(all ? 'Show fewer' : 'View all services')} {all ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
    </section>
  );
}

function Sidebar() {
  const { portal, site, modules } = useSite();
  const { t, pick } = useLang();
  const allowed = useLinkAllowed();
  const socials = (site.socials || []).filter((s) => s.url);
  return (
    <aside className="home-side">
      {modules.events && <Calendar title={portal.calendar_title || t('Meeting calendar')} />}
      {(portal.sidebar_blocks || []).map((b) => {
        const links = (b.links || []).filter((l) => allowed(l.link));
        return (
          <section className="block" key={b.title || b.title_en}>
            <h2 className="block-title">{pick(b.title, b.title_en)}</h2>
            <ul className="block-links">
              {links.map((l) => <li key={l.label}><CircleCheck size={17} aria-hidden="true" /><SmartLink link={l.link}>{pick(l.label, l.label_en)}</SmartLink></li>)}
            </ul>
          </section>
        );
      })}
      {portal.anthem_audio && (
        <section className="block">
          <h2 className="block-title">{t('National anthem')}</h2>
          <audio controls preload="none" src={asset(portal.anthem_audio)} />
        </section>
      )}
      {socials.length > 0 && (
        <section className="block">
          <h2 className="block-title">{t('Social media')}</h2>
          <div className="social-row">{socials.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.label || s.url}</a>)}</div>
        </section>
      )}
      <Hotlines items={portal.hotlines || []} />
    </aside>
  );
}

export default function Home() {
  const { site, portal, modules } = useSite();
  usePageTitle(null);
  const { loading, data, error } = useLoad('/public/home');
  if (loading) return <Spinner />;
  if (error) return <p className="empty">{error.message}</p>;
  const notices = data.sections.find((s) => s.key === 'notices');
  const news = data.sections.find((s) => s.key === 'news');
  const head = data.sections.find((s) => s.key === 'principal');
  const about = data.sections.find((s) => s.key === 'about');
  const historySection = data.sections.find((s) => s.key === 'history');
  return (
    <div className="home-grid">
      <div className="home-col">
        {modules.notices && <NoticeCard items={notices?.items || []} news={news?.items || []} />}
        {head && <HeadMessage c={head.content} />}
        {about && <AboutSchool c={about.content} />}
        {historySection && <HistoryHighlight section={historySection} />}
        <ServiceBoxes boxes={portal.service_boxes || []} />
        <VideoMap videoUrl={portal.video_url} mapUrl={site.map_embed} />
      </div>
      <Sidebar />
    </div>
  );
}
