import fs from 'node:fs';
import path from 'node:path';
import { cfg } from '../config.js';
import { q, one } from './db.js';
import { adminPath, getContent, isEnabled, moduleStates } from './moduleStore.js';
import { escapeHtml } from './mail.js';
import { todayBD } from './util.js';
import { bootPayload } from '../modules/index.js';

const strip = (html, max = 160) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const abs = (url) => (url && url.startsWith('/') ? cfg.publicUrl + url : url);
// Safe inside a <script> block: "<" can never close it.
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

let template = null;
function loadTemplate() {
  if (template && cfg.isProd) return template;
  const file = path.join(cfg.clientDist, 'index.html');
  template = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  return template;
}

const STATIC_ROUTES = {
  '/notices': { module: 'notices', title: 'Notices' },
  '/results': { module: 'results', title: 'Results' },
  '/message': { module: 'principal', title: "Head Teacher's Message" },
  '/about': { module: 'about', title: 'About' },
  '/achievements': { module: 'achievements', title: 'Achievements' },
  '/gallery': { module: 'gallery', title: 'Gallery' },
  '/facilities': { module: 'facilities', title: 'Facilities' },
  '/admission': { module: 'admission', title: 'Admission' },
  '/admission/status': { module: 'admission', title: 'Application Status', noindex: true },
  '/payment/result': { module: 'payments', title: 'Payment', noindex: true },
  '/contact': { module: 'contact', title: 'Contact' },
  '/officers': { module: 'people', title: 'Officers' },
  '/teachers': { module: 'people', title: 'Teachers' },
  '/staff': { module: 'people', title: 'Staff' },
  '/information-officer': { module: 'people', title: 'Information Officer' },
  '/departments': { module: 'departments', title: 'Departments' },
  '/events': { module: 'events', title: 'Meeting Calendar' },
  '/news': { module: 'news', title: 'News' },
  '/publications': { module: 'publications', title: 'Publications' },
  '/activities': { module: 'activities', title: 'Co-curricular Activities' },
  '/feedback': { module: 'feedback', title: 'Feedback' },
  '/history': { module: 'history', title: 'History' },
  '/our-pride': { module: 'alumni', title: 'Our Pride' },
};

const SIGNIN_PAGES = ['/signin', '/signin/forgot', '/signin/activate', '/signin/reset'];

// Works out the title and description of a page, and whether it exists at all.
async function routeMeta(url) {
  if (url === '/') return { found: true };
  const route = STATIC_ROUTES[url];
  if (route) return (await isEnabled(route.module)) ? { found: true, ...route } : { found: false };
  let m = url.match(/^\/notices\/(\d+)$/);
  if (m && (await isEnabled('notices'))) {
    const today = todayBD();
    const n = await one('SELECT title, body FROM notices WHERE id = ? AND published = 1 AND notice_date <= ? AND (expires_on IS NULL OR expires_on >= ?)', [Number(m[1]), today, today]);
    return n ? { found: true, title: n.title, description: strip(n.body) } : { found: false };
  }
  m = url.match(/^\/history\/albums\/(\d+)$/);
  if (m && (await isEnabled('history'))) {
    const a = await one('SELECT title, description FROM history_albums WHERE id = ? AND published = 1', [Number(m[1])]);
    return a ? { found: true, title: a.title, description: strip(a.description) } : { found: false };
  }
  m = url.match(/^\/news\/(\d+)$/);
  if (m && (await isEnabled('news'))) {
    const n = await one('SELECT title, body FROM news WHERE id = ? AND published = 1', [Number(m[1])]);
    return n ? { found: true, title: n.title, description: strip(n.body) } : { found: false };
  }
  m = url.match(/^\/people\/(\d+)$/);
  if (m && (await isEnabled('people'))) {
    const p = await one('SELECT name, designation FROM people WHERE id = ? AND published = 1', [Number(m[1])]);
    return p ? { found: true, title: p.name, description: p.designation || '' } : { found: false };
  }
  m = url.match(/^\/departments\/(\d+)$/);
  if (m && (await isEnabled('departments'))) {
    const d = await one('SELECT name, description FROM departments WHERE id = ? AND published = 1', [Number(m[1])]);
    return d ? { found: true, title: d.name, description: strip(d.description) } : { found: false };
  }
  m = url.match(/^\/p\/([^/]+)$/);
  if (m && (await isEnabled('pages'))) {
    const p = await one('SELECT title, body, seo_description FROM pages WHERE slug = ? AND published = 1', [decodeURIComponent(m[1])]);
    return p ? { found: true, title: p.title, description: p.seo_description || strip(p.body) } : { found: false };
  }
  return { found: false };
}

export async function renderHtml(req, res) {
  const html = loadTemplate();
  if (!html) return res.status(503).type('text').send('The site has not been built yet. Run: npm run build');

  const url = req.path.replace(/\/+$/, '') || '/';
  const panel = await adminPath();
  const isAdmin = url === panel || url.startsWith(`${panel}/`);
  const meta = isAdmin ? { found: true, noindex: true, title: 'Admin' }
    : SIGNIN_PAGES.includes(url) ? { found: true, noindex: true, title: 'Sign in' }
      : url === '/search' ? { found: true, noindex: true, title: 'Search' }
      : await routeMeta(url);
  const [site, seo, siteBoot] = await Promise.all([getContent('site'), getContent('seo'), bootPayload()]);
  // Only a browser already at the private address is told it is one.
  const boot = isAdmin ? { ...siteBoot, adminBase: panel } : siteBoot;

  const school = site.school_name || 'School';
  const title = meta.title ? `${meta.title} | ${school}` : seo.meta_title || (site.tagline ? `${school} | ${site.tagline}` : school);
  const description = meta.description || seo.meta_description || site.tagline || school;
  const canonical = cfg.publicUrl + (url === '/' ? '/' : url);
  const image = abs(seo.og_image || site.logo || '');
  const noindex = meta.noindex || seo.noindex || !meta.found;

  const organisation = {
    '@context': 'https://schema.org',
    '@type': 'School',
    name: school,
    url: cfg.publicUrl,
    ...(site.logo && { logo: abs(site.logo) }),
    ...(site.phone && { telephone: site.phone }),
    ...(site.email && { email: site.email }),
    ...(site.established && { foundingDate: site.established }),
    ...(site.address && { address: { '@type': 'PostalAddress', streetAddress: site.address, addressCountry: 'BD' } }),
    ...(site.socials?.length && { sameAs: site.socials.map((s) => s.url).filter(Boolean) }),
  };

  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtml(school)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    seo.google_verification ? `<meta name="google-site-verification" content="${escapeHtml(seo.google_verification)}">` : '',
    site.favicon ? `<link rel="icon" href="${escapeHtml(site.favicon)}">` : '',
    `<script type="application/ld+json">${jsonForHtml(organisation)}</script>`,
    `<script type="application/json" id="boot-data">${jsonForHtml(boot)}</script>`,
  ].filter(Boolean).join('\n    ');

  // Readable text for crawlers and visitors without JavaScript.
  const fallback = `<noscript><h1>${escapeHtml(school)}</h1><p>${escapeHtml(description)}</p></noscript>`;

  res.status(meta.found ? 200 : 404);
  res.setHeader('Cache-Control', 'no-cache');
  if (noindex) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.type('html').send(html.replace('<!--app-head-->', head).replace('<!--app-fallback-->', fallback));
}

export async function robots(req, res) {
  const seo = await getContent('seo');
  const lines = seo.noindex
    ? ['User-agent: *', 'Disallow: /']
    : ['User-agent: *', 'Allow: /', 'Disallow: /signin', 'Disallow: /api/', '', `Sitemap: ${cfg.publicUrl}/sitemap.xml`];
  res.type('text/plain').send(lines.join('\n') + '\n');
}

export async function sitemap(req, res) {
  const states = await moduleStates();
  const enabled = new Set(states.filter((s) => s.enabled).map((s) => s.key));
  const urls = [{ loc: '/' }];
  for (const [route, r] of Object.entries(STATIC_ROUTES)) {
    if (enabled.has(r.module) && !r.noindex) urls.push({ loc: route });
  }
  if (enabled.has('notices')) {
    const today = todayBD();
    const rows = await q('SELECT id, updated_at FROM notices WHERE published = 1 AND notice_date <= ? AND (expires_on IS NULL OR expires_on >= ?) ORDER BY id DESC LIMIT 500', [today, today]);
    urls.push(...rows.map((n) => ({ loc: `/notices/${n.id}`, lastmod: n.updated_at?.slice(0, 10) })));
  }
  if (enabled.has('pages')) {
    const rows = await q('SELECT slug, updated_at FROM pages WHERE published = 1');
    urls.push(...rows.map((p) => ({ loc: `/p/${encodeURIComponent(p.slug)}`, lastmod: p.updated_at?.slice(0, 10) })));
  }
  const body = urls.map((u) => `<url><loc>${escapeHtml(cfg.publicUrl + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
}
