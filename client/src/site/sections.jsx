import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Atom, Award, BookOpen, Bus, DoorOpen, Dumbbell, FileText, FlaskConical, HeartPulse, Image as ImageIcon, Landmark, Laptop, Microscope, Monitor,
  Music, Play, Sparkles, TestTube2, Trophy, UserRound, Utensils, Wifi, X,
} from 'lucide-react';
import { asset, formatDate } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';

export const FACILITY_ICONS = {
  'door-open': DoorOpen, monitor: Monitor, flask: FlaskConical, atom: Atom, 'test-tube': TestTube2, microscope: Microscope, book: BookOpen, trophy: Trophy,
  bus: Bus, gym: Dumbbell, health: HeartPulse, hall: Landmark, laptop: Laptop, music: Music, canteen: Utensils, wifi: Wifi, sparkles: Sparkles,
};

export function NoticeRow({ notice }) {
  const { t } = useLang();
  const label = formatDate(notice.notice_date).split(' ');
  const hasPdf = notice.attachments?.some((a) => a.kind === 'pdf');
  const hasImage = notice.attachments?.some((a) => a.kind === 'image');
  return (
    <Link to={`/notices/${notice.id}`} className="notice-row">
      <span className="date-tile"><b>{label[0]}</b><span>{label[1]} {label[2]}</span></span>
      <span style={{ minWidth: 0 }}>
        <h3>{notice.title}</h3>
        <span className="notice-meta">
          {notice.pinned ? <span className="badge badge-brand">{t('Pinned')}</span> : null}
          {notice.category && <span className="badge">{notice.category}</span>}
          {hasPdf && <span className="badge"><FileText size={12} /> PDF</span>}
          {hasImage && <span className="badge"><ImageIcon size={12} /> Image</span>}
        </span>
      </span>
    </Link>
  );
}

export function AchievementCards({ items }) {
  return (
    <div className="cards">
      {items.map((a) => (
        <article className="card" key={a.id}>
          {a.image && <img src={asset(a.image)} alt="" loading="lazy" />}
          <div className="card-body">
            <span className="notice-meta" style={{ marginTop: 0 }}>
              {a.year && <span className="badge badge-brand"><Award size={12} /> {a.year}</span>}
              {a.category && <span className="badge">{a.category}</span>}
            </span>
            <h3>{a.title}</h3>
            {a.description && <p>{a.description}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

export function FacilityTile({ item }) {
  const { t } = useLang();
  const Icon = FACILITY_ICONS[item.icon] || Sparkles;
  const isFeature = item.kind === 'feature';
  return (
    <div className={`fac ${isFeature ? 'feature' : ''}`}>
      <Icon size={22} aria-hidden="true" />
      <b>{isFeature ? t('Available') : item.quantity}</b>
      <span>{item.name}</span>
      {item.description && <p>{item.description}</p>}
    </div>
  );
}

function Lightbox({ item, onClose }) {
  const { t } = useLang();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  const youtube = item.type === 'youtube' ? item.url.match(/[?&]v=([\w-]{11})/)?.[1] : null;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.title || 'Media'} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button className="lightbox-close" aria-label={t('Close')} onClick={onClose}><X size={22} /></button>
      <div className="lightbox-inner">
        {item.type === 'image' && <img src={asset(item.url)} alt={item.title || ''} />}
        {item.type === 'video' && <video src={asset(item.url)} controls autoPlay preload="metadata" />}
        {youtube && (
          <iframe src={`https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&rel=0`} title={item.title || 'Video'} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        )}
        {item.title && <p>{item.title}</p>}
      </div>
    </div>
  );
}

// YouTube is only loaded when someone presses play, which keeps the page fast and private.
export function GalleryGrid({ items, className = '' }) {
  const [active, setActive] = useState(null);
  return (
    <>
      <div className={`gallery ${className}`}>
        {items.map((g) => (
          <button key={g.id} onClick={() => setActive(g)} aria-label={`Open ${g.title || g.type}`}>
            {g.type === 'video' && !g.thumb ? <span className="video-tile" style={{ display: 'block' }} /> : <img src={asset(g.thumb || g.url)} alt="" loading="lazy" />}
            {g.type !== 'image' && <span className="play"><Play aria-hidden="true" /></span>}
            {g.title && <span className="cap">{g.title}</span>}
          </button>
        ))}
      </div>
      {active && <Lightbox item={active} onClose={() => setActive(null)} />}
    </>
  );
}

export function Portrait({ src }) {
  return src ? <img className="portrait" src={asset(src)} alt="" loading="lazy" /> : <div className="portrait-empty"><UserRound size={72} /></div>;
}
