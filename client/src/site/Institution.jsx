import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Download, ExternalLink, FileText, Images, LayoutGrid, Search, Table2, UserRound } from 'lucide-react';
import { api, asset, formatDate } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';
import { useSite } from '../lib/site.jsx';
import { Alert, Html, Pagination, Spinner, useLoad } from '../lib/ui.jsx';
import { PageHero } from './Info.jsx';
import { GalleryGrid } from './sections.jsx';

const Body = ({ children }) => <div className="inner" style={{ paddingTop: 12 }}>{children}</div>;
const SORTS = [['default', 'Default'], ['name', 'Name'], ['designation', 'Designation'], ['education', 'Education'], ['email', 'Email'], ['phone', 'Office phone'], ['intercom', 'Intercom'], ['fax', 'Fax']];
const PAGE_SIZES = [10, 20, 50, 100];

const COLUMNS = [
  ['faculty', 'Faculty'], ['department', 'Department'], ['phone_office', 'Office phone'], ['intercom', 'Intercom'],
  ['phone_home', 'Home phone'], ['fax', 'Fax'], ['email', 'Email'], ['mobile', 'Mobile'], ['room', 'Room number'],
];

function PersonCard({ p }) {
  const { pick } = useLang();
  return (
    <article className="person-card">
      <Link to={`/people/${p.id}`} className="person-photo" aria-hidden="true" tabIndex={-1}>
        {p.photo ? <img src={asset(p.photo)} alt="" loading="lazy" /> : <UserRound size={46} />}
      </Link>
      <div className="person-info">
        <h3><Link to={`/people/${p.id}`}>{pick(p.name, p.name_en)}</Link></h3>
        {p.designation && <p className="person-role">{p.designation}</p>}
        {p.education && <p>{p.education}</p>}
        {p.department && <p>{pick(p.department, p.department_en)}</p>}
        {p.phone_office && <p><a href={`tel:${p.phone_office.replace(/[^+\d]/g, '')}`}>{p.phone_office}</a></p>}
        {p.mobile && <p><a href={`tel:${p.mobile.replace(/[^+\d]/g, '')}`}>{p.mobile}</a></p>}
        {p.email && <p><a href={`mailto:${p.email}`}>{p.email}</a></p>}
      </div>
    </article>
  );
}

function PersonTable({ items }) {
  const { t, pick } = useLang();
  // Columns nobody has filled in stay out of the way, which matters on small screens.
  const shown = COLUMNS.filter(([key]) => items.some((p) => p[key]));
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>{t('Photo')}</th><th>{t('Name')}</th><th>{t('Designation')}</th><th>{t('Education')}</th>{shown.map(([k, l]) => <th key={k}>{t(l)}</th>)}<th>{t('CV')}</th></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>{p.photo ? <img src={asset(p.photo)} alt="" loading="lazy" className="table-photo" /> : <span className="table-photo empty"><UserRound size={22} aria-hidden="true" /></span>}</td>
              <td><Link to={`/people/${p.id}`}>{pick(p.name, p.name_en)}</Link></td>
              <td>{p.designation}</td>
              <td>{p.education}</td>
              {shown.map(([k]) => <td key={k}>{p[k]}</td>)}
              <td>{p.cv && <a href={asset(p.cv)} target="_blank" rel="noopener noreferrer" aria-label={t('CV')}><FileText size={16} /></a>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PeopleList({ type, departmentId }) {
  const { t } = useLang();
  const { modules } = useSite();
  const [table, setTable] = useState(false);
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [sort, setSort] = useState('default');
  const [limit, setLimit] = useState(modules.people?.config.default_page_size || 20);
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page, limit, sort });
  if (type) qs.set('type', type);
  if (departmentId) qs.set('department_id', departmentId);
  if (term) qs.set('q', term);
  const { data, loading, error } = useLoad(`/public/people?${qs}`);

  return (
    <>
      <div className="list-tools">
        <button type="button" className="grad-btn" onClick={() => setTable(!table)}>
          {table ? <LayoutGrid size={14} /> : <Table2 size={14} />} {t(table ? 'View as cards' : 'View as table')}
        </button>
      </div>
      <div className="list-filters">
        <form className="list-search" role="search" onSubmit={(e) => { e.preventDefault(); setPage(1); setTerm(input.trim()); }}>
          <input aria-label={t('Search')} placeholder={t('Search')} value={input} onChange={(e) => setInput(e.target.value)} />
          <button type="submit" aria-label={t('Search')}><Search size={14} /></button>
        </form>
        <div className="list-selects">
          <label>{t('Sort by')}
            <select value={sort} onChange={(e) => { setPage(1); setSort(e.target.value); }}>{SORTS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select>
          </label>
          <label>{t('Items per page')}
            <select value={limit} onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }}>{PAGE_SIZES.map((n) => <option key={n}>{n}</option>)}</select>
          </label>
        </div>
      </div>
      {loading && !data && <Spinner />}
      {error && <p className="empty">{error.message}</p>}
      {data && data.items.length === 0 && <p className="empty">{t('No results found.')}</p>}
      {data && data.items.length > 0 && (table ? <PersonTable items={data.items} /> : <div className="people-grid">{data.items.map((p) => <PersonCard key={p.id} p={p} />)}</div>)}
      {data && <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />}
    </>
  );
}

const PEOPLE_TITLES = { officer: 'Officers', teacher: 'Teachers', staff: 'Staff', information: 'Information officer' };

export function PeoplePage({ type }) {
  const { t } = useLang();
  return <><PageHero title={t(PEOPLE_TITLES[type])} /><Body><PeopleList key={type} type={type} /></Body></>;
}

export function PersonDetail() {
  const { id } = useParams();
  const { t, pick } = useLang();
  const { loading, data, error } = useLoad(`/public/people/${encodeURIComponent(id)}`);
  if (loading) return <Spinner />;
  if (error) return <Body><p className="empty">{error.message}</p></Body>;
  const rows = [['education', 'Education'], ...COLUMNS].map(([k, l]) => [t(l), data[k]]).filter(([, v]) => v);
  return (
    <>
      <PageHero title={pick(data.name, data.name_en)} intro={data.designation} />
      <Body>
        <div className="split">
          <div>
            {data.photo ? <img className="portrait" src={asset(data.photo)} alt="" /> : <div className="portrait-empty"><UserRound size={72} /></div>}
            {data.cv && <p style={{ marginTop: 12 }}><a className="grad-btn" href={asset(data.cv)} target="_blank" rel="noopener noreferrer">{t('View CV')}</a></p>}
          </div>
          <div>
            {rows.map(([label, value]) => <div className="step-row" key={label}><span>{label}</span><span>{value}</span></div>)}
            {data.bio && <div style={{ marginTop: 18 }}><Html html={data.bio} /></div>}
          </div>
        </div>
      </Body>
    </>
  );
}

export function DepartmentsPage() {
  const { t, pick } = useLang();
  const { loading, data, error } = useLoad('/public/departments');
  const groups = useMemo(() => {
    const map = new Map();
    (data?.items || []).forEach((d) => map.set(d.faculty || '', [...(map.get(d.faculty || '') || []), d]));
    return [...map];
  }, [data]);
  return (
    <>
      <PageHero title={t('Departments')} />
      <Body>
        {loading && <Spinner />}
        {error && <p className="empty">{error.message}</p>}
        {data && data.items.length === 0 && <p className="empty">{t('Nothing has been added here yet.')}</p>}
        {groups.map(([faculty, list]) => (
          <div className="fac-group" key={faculty}>
            {faculty && <h3>{faculty}</h3>}
            <div className="cards">
              {list.map((d) => (
                <article className="card" key={d.id}>
                  {d.image && <img src={asset(d.image)} alt="" loading="lazy" />}
                  <div className="card-body">
                    <h3 style={{ marginTop: 0 }}><Link to={`/departments/${d.id}`}>{pick(d.name, d.name_en)}</Link></h3>
                    {d.description && <p>{d.description}</p>}
                    <p><span className="badge badge-brand">{d.people_count} {t('Teachers')}</span></p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </Body>
    </>
  );
}

export function DepartmentDetail() {
  const { id } = useParams();
  const { pick } = useLang();
  const { loading, data, error } = useLoad(`/public/departments/${encodeURIComponent(id)}`);
  if (loading) return <Spinner />;
  if (error) return <Body><p className="empty">{error.message}</p></Body>;
  return <><PageHero title={pick(data.name, data.name_en)} intro={data.description} /><Body><PeopleList key={id} departmentId={id} /></Body></>;
}

function EventRow({ e }) {
  return (
    <article className="event-row">
      <span className="date-tile"><b>{formatDate(e.starts_on).split(' ')[0]}</b><span>{formatDate(e.starts_on).split(' ').slice(1).join(' ')}</span></span>
      <div style={{ minWidth: 0 }}>
        <h3>{e.title}</h3>
        <p className="event-meta">{[e.ends_on && `${formatDate(e.starts_on)} - ${formatDate(e.ends_on)}`, e.time_text, e.location].filter(Boolean).join(' · ')}</p>
        {e.description && <Html html={e.description} />}
      </div>
    </article>
  );
}

export function EventsPage() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const date = params.get('date');
  const { loading, data, error } = useLoad(`/public/events${date ? `?date=${encodeURIComponent(date)}` : ''}`);
  return (
    <>
      <PageHero title={t('Meeting calendar')} intro={date ? formatDate(date) : undefined} />
      <Body>
        {loading && <Spinner />}
        {error && <p className="empty">{error.message}</p>}
        {data && data.items.length === 0 && !data.past?.length && <p className="empty">{t('No events found.')}</p>}
        {data?.items.map((e) => <EventRow key={e.id} e={e} />)}
        {data?.past?.length > 0 && (
          <>
            <h2 className="block-title" style={{ marginTop: 24 }}>{t('Past events')}</h2>
            {data.past.map((e) => <EventRow key={e.id} e={e} />)}
          </>
        )}
        {date && <p style={{ marginTop: 18 }}><Link className="more-link" to="/events">{t('All events')}</Link></p>}
      </Body>
    </>
  );
}

export function NewsPage() {
  const { t } = useLang();
  const [page, setPage] = useState(1);
  const { loading, data, error } = useLoad(`/public/news?page=${page}`);
  return (
    <>
      <PageHero title={t('News')} />
      <Body>
        {loading && <Spinner />}
        {error && <p className="empty">{error.message}</p>}
        {data && data.items.length === 0 && <p className="empty">{t('Nothing has been added here yet.')}</p>}
        <div className="notice-list">
          {data?.items.map((n) => {
            const label = formatDate(n.news_date).split(' ');
            const inner = <><span className="date-tile"><b>{label[0]}</b><span>{label[1]} {label[2]}</span></span><h3>{n.title} {n.external_link && <ExternalLink size={13} aria-hidden="true" />}</h3></>;
            return n.external_link
              ? <a key={n.id} className="notice-row" href={n.external_link} target="_blank" rel="noopener noreferrer">{inner}</a>
              : <Link key={n.id} className="notice-row" to={`/news/${n.id}`}>{inner}</Link>;
          })}
        </div>
        {data && <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />}
      </Body>
    </>
  );
}

export function NewsDetail() {
  const { id } = useParams();
  const { t } = useLang();
  const { loading, data, error } = useLoad(`/public/news/${encodeURIComponent(id)}`);
  if (loading) return <Spinner />;
  if (error) return <Body><p className="empty">{error.message}</p></Body>;
  return (
    <>
      <PageHero title={data.title} intro={formatDate(data.news_date)} />
      <Body>
        {data.image && <img src={asset(data.image)} alt="" style={{ marginBottom: 16, width: '100%' }} />}
        <Html html={data.body} />
        <p style={{ marginTop: 24 }}><Link className="more-link" to="/news">{t('All news')}</Link></p>
      </Body>
    </>
  );
}

export function PublicationsPage() {
  const { t } = useLang();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const category = params.get('category') || '';
  const term = params.get('q') || '';
  const [input, setInput] = useState(term);
  const qs = new URLSearchParams({ page });
  if (category) qs.set('category', category);
  if (term) qs.set('q', term);
  const { loading, data, error } = useLoad(`/public/publications?${qs}`);
  const go = (next) => { setPage(1); setParams(Object.fromEntries(Object.entries({ category, q: term, ...next }).filter(([, v]) => v))); };
  return (
    <>
      <PageHero title={category || t('Publications')} />
      <Body>
        <div className="list-filters">
          <form className="list-search" role="search" onSubmit={(e) => { e.preventDefault(); go({ q: input.trim() }); }}>
            <input aria-label={t('Search')} placeholder={t('Search')} value={input} onChange={(e) => setInput(e.target.value)} />
            <button type="submit" aria-label={t('Search')}><Search size={14} /></button>
          </form>
        </div>
        {data?.categories.length > 0 && (
          <div className="filter-row">
            <button aria-pressed={!category} onClick={() => go({ category: '' })}>{t('All')}</button>
            {data.categories.map((c) => <button key={c} aria-pressed={category === c} onClick={() => go({ category: c })}>{c}</button>)}
          </div>
        )}
        {loading && !data && <Spinner />}
        {error && <p className="empty">{error.message}</p>}
        {data && data.items.length === 0 && <p className="empty">{t('No results found.')}</p>}
        {data && data.items.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>{t('Title')}</th><th>{t('Category')}</th><th>{t('Date')}</th><th>{t('Download')}</th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title}{p.description && <div className="help">{p.description}</div>}</td>
                    <td>{p.category}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.pub_date ? formatDate(p.pub_date) : ''}</td>
                    <td><a href={asset(p.file)} target="_blank" rel="noopener noreferrer" aria-label={`${t('Download')} ${p.title}`}><Download size={17} /></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />}
      </Body>
    </>
  );
}

export function ActivitiesPage() {
  const { t } = useLang();
  const { loading, data, error } = useLoad('/public/activities');
  const groups = useMemo(() => {
    const map = new Map();
    (data?.items || []).forEach((a) => map.set(a.category || '', [...(map.get(a.category || '') || []), a]));
    return [...map];
  }, [data]);
  return (
    <>
      <PageHero title={t('Co-curricular activities')} />
      <Body>
        {loading && <Spinner />}
        {error && <p className="empty">{error.message}</p>}
        {data && data.items.length === 0 && <p className="empty">{t('Nothing has been added here yet.')}</p>}
        {groups.map(([category, list]) => (
          <div className="fac-group" key={category}>
            {category && <h3>{category}</h3>}
            <div className="cards">
              {list.map((a) => (
                <article className="card" key={a.id}>
                  {a.image && <img src={asset(a.image)} alt="" loading="lazy" />}
                  <div className="card-body">
                    <h3 style={{ marginTop: 0 }}>{a.title}</h3>
                    {(a.advisor || a.schedule) && <p className="event-meta">{[a.advisor, a.schedule].filter(Boolean).join(' · ')}</p>}
                    {a.description && <Html html={a.description} />}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </Body>
    </>
  );
}

export function HistoryPage() {
  const { t, pick } = useLang();
  const { loading, data, error } = useLoad('/public/history');
  if (loading) return <Spinner />;
  if (error) return <Body><p className="empty">{error.message}</p></Body>;
  const { content, albums } = data;
  return (
    <>
      <PageHero title={t(content.heading || 'History')} intro={content.summary} />
      <Body>
        {content.body && <Html html={content.body} />}
        {!content.body && albums.length === 0 && <p className="empty">{t('Nothing has been added here yet.')}</p>}
        {albums.length > 0 && (
          <>
            <h2 className="block-title" style={{ marginTop: content.body ? 28 : 0 }}>{t('Albums')}</h2>
            <div className="album-grid">
              {albums.map((a) => (
                <Link className="album-card" key={a.id} to={`/history/albums/${a.id}`}>
                  <span className="album-cover">{a.cover ? <img src={asset(a.cover)} alt="" loading="lazy" /> : <Images size={38} aria-hidden="true" />}</span>
                  <span className="album-title">{pick(a.title, a.title_en)}</span>
                  <span className="album-meta">{[a.event_year, `${a.photo_count} ${t('photos')}`].filter(Boolean).join(' · ')}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </Body>
    </>
  );
}

export function AlbumPage() {
  const { id } = useParams();
  const { t, pick } = useLang();
  const { loading, data, error } = useLoad(`/public/history/albums/${encodeURIComponent(id)}`);
  const items = useMemo(() => (data?.photos || []).map((p, i) => ({ id: i, type: 'image', url: p.url, thumb: p.thumb, title: p.caption })), [data]);
  if (loading) return <Spinner />;
  if (error) return <Body><p className="empty">{error.message}</p></Body>;
  return (
    <>
      <PageHero title={pick(data.title, data.title_en)} intro={[data.event_year, data.description].filter(Boolean).join(' · ')} />
      <Body>
        {items.length ? <GalleryGrid items={items} className="photo-grid" /> : <p className="empty">{t('Nothing has been added here yet.')}</p>}
        <p style={{ marginTop: 22 }}><Link className="more-link" to="/history">{t('Back to history')}</Link></p>
      </Body>
    </>
  );
}

export function OurPridePage() {
  const { t, pick } = useLang();
  const { loading, data, error } = useLoad('/public/alumni');
  return (
    <>
      <PageHero title={t('Our Pride')} />
      <Body>
        {loading && <Spinner />}
        {error && <p className="empty">{error.message}</p>}
        {data && data.items.length === 0 && <p className="empty">{t('Nothing has been added here yet.')}</p>}
        {data && data.items.length > 0 && (
          <div className="pride-grid">
            {data.items.map((a) => (
              <article className="pride-card" key={a.id}>
                <span className="pride-photo">{a.photo ? <img src={asset(a.photo)} alt="" loading="lazy" /> : <UserRound size={54} aria-hidden="true" />}</span>
                <h3>{pick(a.name, a.name_en)}</h3>
                <p className="pride-role">{pick(a.designation, a.designation_en)}</p>
                {a.passing_year && <p className="pride-year">{a.passing_year}</p>}
                {a.about && <p>{a.about}</p>}
              </article>
            ))}
          </div>
        )}
      </Body>
    </>
  );
}

export function FeedbackPage() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', subject: '', message: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const honeypot = useRef(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  useEffect(() => { if (sent) window.scrollTo(0, 0); }, [sent]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    try {
      await api.post('/public/feedback', { ...form, page: params.get('page') || '', website: honeypot.current?.value || '' });
      setSent(true);
    } catch (err) {
      setError(err.message);
      setFields(err.details || {});
    } finally {
      setBusy(false);
    }
  };

  const Field = (key, label, required, type = 'text') => (
    <div className={`field ${fields[key] ? 'has-err' : ''}`}>
      <label htmlFor={`fb-${key}`}>{t(label)} {required && <span className="req">*</span>}</label>
      <input id={`fb-${key}`} type={type} required={required} value={form[key]} onChange={set(key)} />
      {fields[key] && <span className="err">{fields[key]}</span>}
    </div>
  );

  return (
    <>
      <PageHero title={t('Give your feedback')} />
      <Body>
        <div className="narrow">
          {sent ? <Alert kind="success">{t('Thank you. Your feedback has been sent to the school.')}</Alert> : (
            <form className="panel form-grid" onSubmit={submit}>
              <div className="hp" aria-hidden="true"><label>Website<input ref={honeypot} tabIndex={-1} autoComplete="off" /></label></div>
              {Field('name', 'Name', true)}
              {Field('email', 'Email', false, 'email')}
              {Field('mobile', 'Mobile', false, 'tel')}
              {Field('subject', 'Subject', false)}
              <div className={`field span-full ${fields.message ? 'has-err' : ''}`}>
                <label htmlFor="fb-message">{t('Your message')} <span className="req">*</span></label>
                <textarea id="fb-message" required rows={6} maxLength={5000} value={form.message} onChange={set('message')} />
                {fields.message && <span className="err">{fields.message}</span>}
              </div>
              {error && <div className="span-full"><Alert>{error}</Alert></div>}
              <div className="span-full"><button className="grad-btn" disabled={busy} style={{ padding: '8px 22px' }}>{t(busy ? 'Submitting...' : 'Send')}</button></div>
            </form>
          )}
        </div>
      </Body>
    </>
  );
}
