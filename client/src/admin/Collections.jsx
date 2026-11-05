import React from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { asset, formatDate } from '../lib/api.js';
import { Alert, useLoad } from '../lib/ui.jsx';
import { Manager, YesNo } from './widgets.jsx';
import { useAdmin } from './AdminApp.jsx';
import { INSTITUTION, peopleConfig } from './institutionConfig.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const safeJson = (v) => {
  try {
    return typeof v === 'string' ? JSON.parse(v) : v || [];
  } catch {
    return [];
  }
};

const ICONS = [
  ['door-open', 'Door / classroom'], ['monitor', 'Computer'], ['laptop', 'Laptop'], ['flask', 'Flask'], ['atom', 'Atom'], ['test-tube', 'Test tube'], ['microscope', 'Microscope'],
  ['book', 'Book'], ['trophy', 'Trophy'], ['bus', 'Bus'], ['gym', 'Gym'], ['health', 'Health'], ['hall', 'Hall'], ['music', 'Music'], ['canteen', 'Canteen'], ['wifi', 'Wi-Fi'], ['sparkles', 'Other'],
].map(([value, label]) => ({ value, label }));

const CONFIG = {
  notices: {
    moduleKey: 'notices',
    title: 'Noticeboard',
    intro: 'Write a notice, attach files, or both. PDF, JPG, JPEG and PNG are accepted.',
    url: '/admin/notices',
    addLabel: 'New notice',
    wide: true,
    blank: () => ({ title: '', category: '', notice_date: today(), expires_on: '', pinned: false, published: true, body: '', attachments: [] }),
    normalize: (r) => ({ ...r, attachments: safeJson(r.attachments), pinned: Boolean(r.pinned), published: Boolean(r.published) }),
    columns: [
      { label: 'Title', render: (r) => <strong>{r.title}</strong> },
      { label: 'Date', render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{formatDate(r.notice_date)}</span> },
      { label: 'Files', render: (r) => safeJson(r.attachments).length || '-' },
      { label: 'Status', render: (r) => <><YesNo value={r.published} /> {r.pinned ? <span className="badge badge-brand">Pinned</span> : null}</> },
    ],
    fields: [
      { key: 'title', label: 'Title', required: true, full: true },
      { key: 'category', label: 'Category', help: 'For example Exams, Admission or Holidays.' },
      { key: 'notice_date', label: 'Notice date', type: 'date', required: true, help: 'A future date schedules the notice.' },
      { key: 'expires_on', label: 'Hide after', type: 'date', help: 'Optional.' },
      { key: 'body', label: 'Notice text', type: 'html' },
      { key: 'attachments', label: 'Attachments', type: 'attachments' },
      { key: 'pinned', label: 'Pin to the top', type: 'switch' },
      { key: 'published', label: 'Published', type: 'switch' },
    ],
  },
  achievements: {
    moduleKey: 'achievements',
    title: 'Achievements',
    url: '/admin/achievements',
    addLabel: 'Add achievement',
    blank: () => ({ title: '', year: String(new Date().getFullYear()), category: '', description: '', image: '', sort_order: 0, published: true }),
    normalize: (r) => ({ ...r, published: Boolean(r.published) }),
    columns: [
      { label: 'Title', render: (r) => <strong>{r.title}</strong> },
      { label: 'Year', key: 'year' },
      { label: 'Category', key: 'category' },
      { label: 'Status', render: (r) => <YesNo value={r.published} /> },
    ],
    fields: [
      { key: 'title', label: 'Title', required: true, full: true },
      { key: 'year', label: 'Year' },
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'sort_order', label: 'Order', type: 'number', help: 'Lower numbers come first.' },
      { key: 'published', label: 'Published', type: 'switch' },
    ],
  },
  gallery: {
    moduleKey: 'gallery',
    title: 'Media & Gallery',
    intro: 'Add photos, YouTube links or self-hosted videos. YouTube links are the lightest choice for shared hosting.',
    url: '/admin/gallery',
    addLabel: 'Add media',
    blank: () => ({ type: 'image', title: '', album: '', url: '', thumb: '', sort_order: 0, published: true }),
    normalize: (r) => ({ ...r, published: Boolean(r.published) }),
    columns: [
      { label: 'Preview', render: (r) => (r.thumb || r.type === 'image' ? <img src={asset(r.thumb || r.url)} alt="" style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 7 }} loading="lazy" /> : <span className="badge">Video</span>) },
      { label: 'Title', key: 'title' },
      { label: 'Type', render: (r) => <span className="badge">{r.type}</span> },
      { label: 'Album', key: 'album' },
      { label: 'Status', render: (r) => <YesNo value={r.published} /> },
    ],
    fields: [
      { key: 'type', label: 'Type', type: 'select', required: true, placeholder: false, options: [{ value: 'image', label: 'Photo' }, { value: 'youtube', label: 'YouTube video' }, { value: 'video', label: 'Self-hosted video' }] },
      { key: 'title', label: 'Title' },
      { key: 'album', label: 'Album' },
      { key: 'sort_order', label: 'Order', type: 'number' },
      { key: 'url', label: 'YouTube link', required: true, full: true, visible: (v) => v.type === 'youtube', help: 'For example https://www.youtube.com/watch?v=...' },
      {
        key: 'url', label: 'File', type: 'upload', full: true, required: true, visible: (v) => v.type !== 'youtube',
        purpose: (v) => (v.type === 'video' ? 'video' : 'image'),
      },
      { key: 'thumb', label: 'Cover image (optional)', type: 'image', visible: (v) => v.type === 'video' },
      { key: 'published', label: 'Published', type: 'switch' },
    ],
  },
  facilities: {
    moduleKey: 'facilities',
    title: 'Facilities',
    intro: 'Set how many of each you have, and add your own.',
    url: '/admin/facilities',
    addLabel: 'Add facility',
    note: <div style={{ marginBottom: 14 }}><Alert kind="info">Anything with a number of 0 is hidden on the website automatically, so a lab you do not have will not show.</Alert></div>,
    blank: () => ({ name: '', kind: 'count', category: '', quantity: 1, description: '', icon: 'sparkles', image: '', sort_order: 0, published: true }),
    normalize: (r) => ({ ...r, published: Boolean(r.published) }),
    columns: [
      { label: 'Name', render: (r) => <strong>{r.name}</strong> },
      { label: 'Category', key: 'category' },
      { label: 'Number', render: (r) => (r.kind === 'feature' ? 'Yes/No item' : r.quantity) },
      {
        label: 'On website',
        render: (r) => {
          if (!r.published) return <span className="badge">Hidden</span>;
          if (r.kind === 'count' && r.quantity === 0) return <span className="badge badge-warn">Hidden (0)</span>;
          return <span className="badge badge-good">Showing</span>;
        },
      },
    ],
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'category', label: 'Category', help: 'For example Labs, Classrooms or Sports.' },
      { key: 'kind', label: 'Type', type: 'select', placeholder: false, options: [{ value: 'count', label: 'Has a number (classrooms, labs)' }, { value: 'feature', label: 'Available or not (playground)' }] },
      { key: 'quantity', label: 'Number', type: 'number', min: 0, visible: (v) => v.kind === 'count' },
      { key: 'icon', label: 'Icon', type: 'select', placeholder: false, options: ICONS },
      { key: 'sort_order', label: 'Order', type: 'number' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'published', label: 'Show on the website', type: 'switch' },
    ],
  },
  pages: {
    moduleKey: 'pages',
    title: 'Custom Pages',
    intro: 'Create extra pages, such as Rules, Teachers or Syllabus.',
    url: '/admin/pages',
    addLabel: 'New page',
    wide: true,
    blank: () => ({ title: '', slug: '', body: '', seo_description: '', in_nav: true, sort_order: 0, published: true }),
    normalize: (r) => ({ ...r, in_nav: Boolean(r.in_nav), published: Boolean(r.published) }),
    columns: [
      { label: 'Title', render: (r) => <strong>{r.title}</strong> },
      { label: 'Address', render: (r) => <code>/p/{r.slug}</code> },
      { label: 'Menu', render: (r) => <YesNo value={r.in_nav} yes="In menu" no="Not in menu" /> },
      { label: 'Status', render: (r) => <YesNo value={r.published} /> },
    ],
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'slug', label: 'Web address', help: 'Leave empty to create it from the title.' },
      { key: 'body', label: 'Content', type: 'html' },
      { key: 'seo_description', label: 'Search description', type: 'textarea' },
      { key: 'sort_order', label: 'Menu order', type: 'number' },
      { key: 'in_nav', label: 'Show in the main menu', type: 'switch' },
      { key: 'published', label: 'Published', type: 'switch' },
    ],
  },
};

export function PeopleAdmin() {
  const { user } = useAdmin();
  const { data } = useLoad('/admin/departments?limit=200');
  const settings = user.role === 'admin' && <Link className="btn btn-ghost" to="/modules/people"><Settings size={15} /> Settings</Link>;
  return <Manager key={data ? 'ready' : 'loading'} {...peopleConfig(data?.items || [])} headerExtra={settings} />;
}

export default function Collections({ kind }) {
  const { user } = useAdmin();
  const c = CONFIG[kind] || INSTITUTION[kind];
  const settings = user.role === 'admin' && <Link className="btn btn-ghost" to={`/modules/${c.moduleKey}`}><Settings size={15} /> {c.settingsLabel || 'Settings'}</Link>;
  return <Manager key={kind} {...c} headerExtra={settings} />;
}
