import React from 'react';
import { asset, formatDate } from '../lib/api.js';
import { YesNo } from './widgets.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const bool = (r) => ({ ...r, published: Boolean(r.published) });
const statusColumn = { label: 'Status', render: (r) => <YesNo value={r.published} /> };
const orderField = { key: 'sort_order', label: 'Order', type: 'number', help: 'Lower numbers come first.' };
const publishedField = { key: 'published', label: 'Published', type: 'switch' };

export const PERSON_TYPES = [
  { value: 'officer', label: 'Officer (কর্মকর্তা)' },
  { value: 'teacher', label: 'Teacher (শিক্ষক)' },
  { value: 'staff', label: 'Staff (কর্মচারী)' },
  { value: 'information', label: 'Information officer (তথ্য প্রদানকারী)' },
];

export const peopleConfig = (departments = []) => ({
  moduleKey: 'people',
  title: 'Teachers & Staff',
  intro: 'These fill the Officers, Teachers, Staff and Information Officer pages, with card and table views.',
  url: '/admin/people',
  addLabel: 'Add person',
  wide: true,
  blank: () => ({ type: 'teacher', name: '', name_en: '', designation: '', education: '', department_id: '', photo: '', phone_office: '', intercom: '', phone_home: '', fax: '', email: '', mobile: '', room: '', cv: '', bio: '', sort_order: 0, published: true }),
  normalize: (r) => ({ ...bool(r), department_id: r.department_id ?? '' }),
  columns: [
    { label: 'Photo', render: (r) => (r.photo ? <img src={asset(r.photo)} alt="" className="admin-thumb" loading="lazy" /> : <span className="admin-thumb empty" aria-hidden="true" />) },
    { label: 'Name', render: (r) => <strong>{r.name}</strong> },
    { label: 'Type', render: (r) => <span className="badge">{r.type}</span> },
    { label: 'Designation', key: 'designation' },
    { label: 'Department', render: (r) => departments.find((d) => d.id === r.department_id)?.name || '-' },
    statusColumn,
  ],
  fields: [
    { key: 'type', label: 'Type', type: 'select', required: true, placeholder: false, options: PERSON_TYPES },
    { key: 'name', label: 'Name', required: true },
    { key: 'name_en', label: 'Name in English' },
    { key: 'designation', label: 'Designation' },
    { key: 'department_id', label: 'Department', type: 'select', placeholder: 'None', options: departments.map((d) => ({ value: d.id, label: d.name })) },
    { key: 'education', label: 'Education', help: 'For example M.Sc. (Physics), B.Ed.' },
    { key: 'room', label: 'Room number' },
    { key: 'phone_office', label: 'Office phone' },
    { key: 'intercom', label: 'Intercom' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'phone_home', label: 'Home phone', help: 'Hidden from the public unless turned on in Settings.' },
    { key: 'fax', label: 'Fax' },
    { key: 'email', label: 'Email' },
    { key: 'photo', label: 'Photo', type: 'image' },
    { key: 'cv', label: 'CV (PDF or image)', type: 'upload', purpose: 'document' },
    { key: 'bio', label: 'Biography', type: 'html' },
    orderField,
    publishedField,
  ],
});

const parsePhotos = (r) => {
  try {
    return typeof r.photos === 'string' ? JSON.parse(r.photos) : r.photos || [];
  } catch {
    return [];
  }
};

export const INSTITUTION = {
  history: {
    moduleKey: 'history',
    settingsLabel: 'History text and settings',
    title: 'History albums',
    intro: 'Add photo albums here. Their photos appear on the homepage. Use "History text and settings" for the written history.',
    url: '/admin/history/albums',
    addLabel: 'New album',
    wide: true,
    blank: () => ({ title: '', title_en: '', event_year: '', description: '', cover: '', photos: [], sort_order: 0, published: true }),
    normalize: (r) => ({ ...bool(r), photos: parsePhotos(r) }),
    columns: [
      { label: 'Album', render: (r) => <strong>{r.title}</strong> },
      { label: 'Year', key: 'event_year' },
      { label: 'Photos', render: (r) => parsePhotos(r).length },
      statusColumn,
    ],
    fields: [
      { key: 'title', label: 'Album title', required: true },
      { key: 'title_en', label: 'Title in English' },
      { key: 'event_year', label: 'Year' },
      orderField,
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'photos', label: 'Photos', type: 'gallery' },
      { key: 'cover', label: 'Cover image (optional)', type: 'image', help: 'The first photo is used if left empty.', full: true },
      publishedField,
    ],
  },
  alumni: {
    moduleKey: 'alumni',
    title: 'Our Pride',
    intro: 'Highlight notable former students with their photo, name and designation.',
    url: '/admin/alumni',
    addLabel: 'Add person',
    blank: () => ({ name: '', name_en: '', designation: '', designation_en: '', passing_year: '', about: '', photo: '', sort_order: 0, published: true }),
    normalize: bool,
    columns: [
      { label: 'Photo', render: (r) => (r.photo ? <img src={asset(r.photo)} alt="" className="admin-thumb" loading="lazy" /> : <span className="admin-thumb empty" aria-hidden="true" />) },
      { label: 'Name', render: (r) => <strong>{r.name}</strong> },
      { label: 'Designation', key: 'designation' },
      { label: 'Year', key: 'passing_year' },
      statusColumn,
    ],
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'name_en', label: 'Name in English' },
      { key: 'designation', label: 'Designation', required: true },
      { key: 'designation_en', label: 'Designation in English' },
      { key: 'passing_year', label: 'Passing year or batch' },
      orderField,
      { key: 'about', label: 'About', type: 'textarea' },
      { key: 'photo', label: 'Photo', type: 'image', full: true },
      publishedField,
    ],
  },
  departments: {
    moduleKey: 'departments',
    title: 'Departments',
    intro: 'Each department page lists the teachers assigned to it.',
    url: '/admin/departments',
    addLabel: 'Add department',
    blank: () => ({ name: '', name_en: '', faculty: '', description: '', image: '', sort_order: 0, published: true }),
    normalize: bool,
    columns: [{ label: 'Department', render: (r) => <strong>{r.name}</strong> }, { label: 'Faculty', key: 'faculty' }, statusColumn],
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'name_en', label: 'Name in English' },
      { key: 'faculty', label: 'Faculty', help: 'For example Science or Humanities.' },
      orderField,
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'image', label: 'Image', type: 'image' },
      publishedField,
    ],
  },
  events: {
    moduleKey: 'events',
    title: 'Meeting Calendar',
    intro: 'Dates with an event are highlighted on the home page calendar.',
    url: '/admin/events',
    addLabel: 'Add event',
    wide: true,
    blank: () => ({ title: '', starts_on: today(), ends_on: '', time_text: '', location: '', description: '', published: true }),
    normalize: bool,
    columns: [
      { label: 'Event', render: (r) => <strong>{r.title}</strong> },
      { label: 'Date', render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{formatDate(r.starts_on)}{r.ends_on ? ` to ${formatDate(r.ends_on)}` : ''}</span> },
      { label: 'Place', key: 'location' },
      statusColumn,
    ],
    fields: [
      { key: 'title', label: 'Title', required: true, full: true },
      { key: 'starts_on', label: 'Date', type: 'date', required: true },
      { key: 'ends_on', label: 'End date', type: 'date', help: 'Only for events longer than a day.' },
      { key: 'time_text', label: 'Time', help: 'For example 11:00 am.' },
      { key: 'location', label: 'Place' },
      { key: 'description', label: 'Details', type: 'html' },
      publishedField,
    ],
  },
  news: {
    moduleKey: 'news',
    title: 'News',
    intro: 'Headlines scroll in the "খবর" strip on the home page.',
    url: '/admin/news',
    addLabel: 'Add news',
    wide: true,
    blank: () => ({ title: '', news_date: today(), expires_on: '', external_link: '', image: '', body: '', published: true }),
    normalize: bool,
    columns: [{ label: 'Headline', render: (r) => <strong>{r.title}</strong> }, { label: 'Date', render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{formatDate(r.news_date)}</span> }, statusColumn],
    fields: [
      { key: 'title', label: 'Headline', required: true, full: true },
      { key: 'news_date', label: 'Date', type: 'date', required: true },
      { key: 'expires_on', label: 'Hide after', type: 'date' },
      { key: 'external_link', label: 'Link to another page', full: true, help: 'Optional. The headline then opens this link instead of the details below.' },
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'body', label: 'Details', type: 'html' },
      publishedField,
    ],
  },
  publications: {
    moduleKey: 'publications',
    title: 'Publications',
    intro: 'Downloads such as syllabus, class routine, forms and magazines. Use the categories "সিলেবাস" and "ক্লাস রুটিন" to fill those menu items.',
    url: '/admin/publications',
    addLabel: 'Add publication',
    blank: () => ({ title: '', category: '', pub_date: today(), description: '', file: '', sort_order: 0, published: true }),
    normalize: bool,
    columns: [{ label: 'Title', render: (r) => <strong>{r.title}</strong> }, { label: 'Category', key: 'category' }, { label: 'Date', render: (r) => (r.pub_date ? formatDate(r.pub_date) : '-') }, statusColumn],
    fields: [
      { key: 'title', label: 'Title', required: true, full: true },
      { key: 'category', label: 'Category' },
      { key: 'pub_date', label: 'Date', type: 'date' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'file', label: 'File (PDF or image)', type: 'upload', purpose: 'document', required: true, full: true },
      orderField,
      publishedField,
    ],
  },
  activities: {
    moduleKey: 'activities',
    title: 'Co-curricular Activities',
    intro: 'Clubs, sports and cultural programmes.',
    url: '/admin/activities',
    addLabel: 'Add activity',
    wide: true,
    blank: () => ({ title: '', category: '', advisor: '', schedule: '', description: '', image: '', sort_order: 0, published: true }),
    normalize: bool,
    columns: [{ label: 'Name', render: (r) => <strong>{r.title}</strong> }, { label: 'Category', key: 'category' }, { label: 'In charge', key: 'advisor' }, statusColumn],
    fields: [
      { key: 'title', label: 'Name', required: true },
      { key: 'category', label: 'Category', help: 'For example ক্লাব or খেলাধুলা.' },
      { key: 'advisor', label: 'Teacher in charge' },
      { key: 'schedule', label: 'When' },
      { key: 'image', label: 'Image', type: 'image' },
      orderField,
      { key: 'description', label: 'Description', type: 'html' },
      publishedField,
    ],
  },
};
