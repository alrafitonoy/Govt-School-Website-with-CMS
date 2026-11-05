import { Router } from 'express';
import { q, one } from '../core/db.js';
import { adminOnly, can, hasPerm } from '../core/auth.js';
import { audit, bad, escapeLike, notFound, todayBD } from '../core/util.js';
import {
  adminConfigView, ensureAdminPath, getConfig, getContent, invalidate, isEnabled, manifest, manifests, moduleStates, registerModule, saveConfig, saveContent, syncModules,
} from '../core/moduleStore.js';
import { about, contact, hero, principal, site } from './site.js';
import { portal, upgradePortalContent } from './portal.js';
import { alumni, history, historyHomePhotos } from './heritage.js';
import { activities, departments, events, feedback, latestNews, news, people, publications } from './institution.js';
import { achievements, facilities, gallery, latestNotices, notices, pages, publicFacilities } from './collections.js';
import { results } from './results.js';
import { admission } from './admission.js';
import { payments } from './payments.js';
import { accounts, email, media, security, seo } from './system.js';

// Registration order is the default menu and home page order. Add a new module by listing it here.
const ALL = [site, portal, hero, notices, news, principal, about, history, alumni, people, departments, activities, publications, events, results, achievements, facilities, gallery, admission, payments, feedback, contact, pages, media, email, seo, accounts, security];

export async function setupModules() {
  ALL.forEach(registerModule);
  await syncModules();
  await ensureAdminPath();
  await upgradePortalContent();
}

const admissionOpen = (c) => {
  const today = todayBD();
  return Boolean(c.open) && (!c.start_date || today >= c.start_date) && (!c.end_date || today <= c.end_date);
};

async function bootPayload() {
  const states = await moduleStates();
  const siteContent = await getContent('site');
  const seoContent = await getContent('seo');
  const modules = {};
  const nav = [];
  for (const s of states) {
    if (!s.enabled) continue;
    const m = manifest(s.key);
    const publicConfig = {};
    for (const k of m.publicConfig || []) publicConfig[k] = s.config[k];
    modules[s.key] = { config: publicConfig };
    if (m.nav) nav.push({ key: s.key, ...m.nav });
  }
  if (modules.admission) modules.admission.config.open = admissionOpen(await getConfig('admission'));
  if (modules.pages) {
    const custom = await q('SELECT slug, title FROM pages WHERE in_nav = 1 AND published = 1 ORDER BY sort_order, title');
    const at = nav.findIndex((n) => n.key === 'contact');
    nav.splice(at < 0 ? nav.length : at, 0, ...custom.map((p) => ({ key: `page:${p.slug}`, label: p.title, path: `/p/${p.slug}` })));
  }
  const ticker = modules.notices?.config.show_ticker ? await latestNotices(5) : [];
  const [changed] = await q("SELECT MAX(created_at) AS at FROM audit_log WHERE action NOT LIKE 'login%' AND action NOT LIKE 'password%'");
  return {
    site: siteContent,
    portal: await getContent('portal'),
    banner: modules.hero ? await getContent('hero') : {},
    lastUpdated: changed?.at || null,
    modules,
    nav,
    ticker: ticker.map(({ id, title }) => ({ id, title })),
    seo: { meta_title: seoContent.meta_title, meta_description: seoContent.meta_description },
  };
}

export { bootPayload };

export function mountModules(pub, admin) {
  pub.get('/boot', async (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json(await bootPayload());
  });

  pub.get('/search', async (req, res) => {
    const term = String(req.query.q || '').trim().slice(0, 80);
    if (term.length < 2) return res.json({ items: [] });
    const like = `%${escapeLike(term)}%`;
    const items = [];
    if (await isEnabled('notices')) {
      const today = todayBD();
      const rows = await q('SELECT id, title FROM notices WHERE published = 1 AND notice_date <= ? AND (expires_on IS NULL OR expires_on >= ?) AND (title LIKE ? OR body LIKE ?) ORDER BY notice_date DESC LIMIT 20', [today, today, like, like]);
      items.push(...rows.map((n) => ({ kind: 'notice', title: n.title, path: `/notices/${n.id}` })));
    }
    if (await isEnabled('pages')) {
      const rows = await q('SELECT slug, title FROM pages WHERE published = 1 AND (title LIKE ? OR body LIKE ?) LIMIT 20', [like, like]);
      items.push(...rows.map((p) => ({ kind: 'page', title: p.title, path: `/p/${p.slug}` })));
    }
    if (await isEnabled('achievements')) {
      const rows = await q('SELECT title FROM achievements WHERE published = 1 AND (title LIKE ? OR description LIKE ?) LIMIT 10', [like, like]);
      items.push(...rows.map((a) => ({ kind: 'achievement', title: a.title, path: '/achievements' })));
    }
    if (await isEnabled('news')) {
      const today = todayBD();
      const rows = await q('SELECT id, title FROM news WHERE published = 1 AND news_date <= ? AND (expires_on IS NULL OR expires_on >= ?) AND (title LIKE ? OR body LIKE ?) LIMIT 15', [today, today, like, like]);
      items.push(...rows.map((n) => ({ kind: 'news', title: n.title, path: `/news/${n.id}` })));
    }
    if (await isEnabled('people')) {
      const rows = await q('SELECT id, name, designation FROM people WHERE published = 1 AND (name LIKE ? OR name_en LIKE ? OR designation LIKE ?) LIMIT 15', [like, like, like]);
      items.push(...rows.map((p) => ({ kind: 'person', title: [p.name, p.designation].filter(Boolean).join(', '), path: `/people/${p.id}` })));
    }
    if (await isEnabled('alumni')) {
      const rows = await q('SELECT name, designation FROM alumni WHERE published = 1 AND (name LIKE ? OR name_en LIKE ? OR designation LIKE ?) LIMIT 15', [like, like, like]);
      items.push(...rows.map((a) => ({ kind: 'alumnus', title: [a.name, a.designation].filter(Boolean).join(', '), path: '/our-pride' })));
    }
    if (await isEnabled('publications')) {
      const rows = await q('SELECT title FROM publications WHERE published = 1 AND (title LIKE ? OR description LIKE ?) LIMIT 15', [like, like]);
      items.push(...rows.map((p) => ({ kind: 'publication', title: p.title, path: `/publications?q=${encodeURIComponent(p.title)}` })));
    }
    res.json({ items });
  });

  pub.get('/content/:key', async (req, res) => {
    const key = String(req.params.key);
    if (!['about', 'principal', 'contact', 'hero'].includes(key) || !(await isEnabled(key))) throw notFound();
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json(await getContent(key));
  });

  // One request for the whole home page. Sections follow the module order set by the admin.
  pub.get('/home', async (req, res) => {
    const states = await moduleStates();
    const sections = [];
    for (const s of states) {
      const m = manifest(s.key);
      if (!s.enabled || !m.home) continue;
      const section = { key: s.key };
      if (['hero', 'principal', 'about'].includes(s.key)) {
        section.content = s.content;
      } else if (s.key === 'history') {
        section.content = s.content;
        section.items = await historyHomePhotos(Number(s.config.home_photos) || 8);
      } else if (s.key === 'notices') {
        section.items = await latestNotices(Number(s.config.home_count) || 5);
      } else if (s.key === 'news') {
        section.items = await latestNews(Number(s.config.home_count) || 5);
      } else if (s.key === 'achievements') {
        section.items = await q('SELECT id, title, year, category, description, image FROM achievements WHERE published = 1 ORDER BY sort_order, year DESC, id DESC LIMIT ?', [Number(s.config.home_count) || 3]);
      } else if (s.key === 'gallery') {
        section.items = await q('SELECT id, type, title, url, thumb FROM gallery_items WHERE published = 1 ORDER BY sort_order, id DESC LIMIT ?', [Number(s.config.home_count) || 6]);
      } else if (s.key === 'facilities') {
        section.items = await publicFacilities();
      } else if (s.key === 'admission') {
        const c = await getConfig('admission');
        section.open = admissionOpen(c);
        section.session_year = c.session_year;
        section.end_date = c.end_date;
      }
      sections.push(section);
    }
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ sections });
  });

  const contentPerm = (key) => {
    const m = manifest(key);
    return m?.permissions?.[0]?.key || 'site.manage';
  };

  // Module list for the admin panel. Staff only see what their permissions allow.
  admin.get('/modules', async (req, res) => {
    const states = await moduleStates();
    const items = states
      .map((s) => {
        const m = manifest(s.key);
        const allowed = req.user.role === 'admin' || (!m.adminOnly && (m.permissions || []).some((p) => hasPerm(req.user, p.key)));
        if (!allowed) return null;
        return {
          key: s.key, title: m.title, description: m.description, group: m.group, locked: Boolean(m.locked), enabled: s.enabled, sort: s.sort,
          adminPath: m.adminPath || null, hasContent: Boolean(m.contentSchema), hasConfig: Boolean(m.schema?.length),
          contentPublic: Boolean(m.nav),
        };
      })
      .filter(Boolean);
    res.json({ items });
  });

  admin.get('/modules/:key', async (req, res, next) => {
    const m = manifest(req.params.key);
    if (!m) throw notFound();
    const s = (await moduleStates()).find((x) => x.key === m.key);
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && (m.adminOnly || !hasPerm(req.user, contentPerm(m.key)))) throw bad('You do not have permission to view this module.');
    res.json({
      key: m.key, title: m.title, description: m.description, group: m.group, locked: Boolean(m.locked), enabled: s.enabled, sort: s.sort, adminPath: m.adminPath || null,
      schema: isAdmin ? m.schema || [] : [],
      config: isAdmin ? adminConfigView(m, s.config) : {},
      contentSchema: m.contentSchema || null,
      content: s.content,
      classes: await q('SELECT id, name FROM classes ORDER BY level'),
    });
  });

  admin.put('/modules/:key/state', adminOnly, async (req, res) => {
    const m = manifest(req.params.key);
    if (!m) throw notFound();
    if (m.locked && req.body?.enabled === false) throw bad(`${m.title} is a core module and cannot be turned off.`);
    await q('UPDATE modules SET enabled = ? WHERE mkey = ?', [req.body?.enabled ? 1 : 0, m.key]);
    invalidate();
    await audit(req, req.body?.enabled ? 'module.enable' : 'module.disable', m.key);
    res.json({ ok: true });
  });

  admin.put('/modules-order', adminOnly, async (req, res) => {
    const keys = Array.isArray(req.body?.keys) ? req.body.keys : [];
    let sort = 0;
    for (const key of keys) {
      if (manifest(key)) await q('UPDATE modules SET sort_order = ? WHERE mkey = ?', [(sort += 10), key]);
    }
    invalidate();
    await audit(req, 'module.reorder');
    res.json({ ok: true });
  });

  admin.put('/modules/:key/config', adminOnly, async (req, res) => {
    await saveConfig(String(req.params.key), req.body || {});
    await audit(req, 'module.config', req.params.key);
    res.json({ ok: true });
  });

  admin.put('/modules/:key/content', async (req, res, next) => {
    const key = String(req.params.key);
    if (!manifest(key)?.contentSchema) throw notFound();
    can(contentPerm(key))(req, res, async (err) => {
      if (err) return next(err);
      try {
        const content = await saveContent(key, req.body || {});
        await audit(req, 'module.content', key);
        res.json(content);
      } catch (e) {
        next(e);
      }
    });
  });

  admin.get('/dashboard', async (req, res) => {
    const count = async (sql) => (await one(sql)).c;
    res.json({
      notices: await count('SELECT COUNT(*) AS c FROM notices WHERE published = 1'),
      students: await count('SELECT COUNT(*) AS c FROM students WHERE active = 1'),
      applications: await count("SELECT COUNT(*) AS c FROM applications WHERE status = 'submitted'"),
      payments: await count("SELECT COUNT(*) AS c FROM payments WHERE status = 'awaiting_verification'"),
      exams: await count('SELECT COUNT(*) AS c FROM exams WHERE published = 1'),
      media: await count('SELECT COUNT(*) AS c FROM media'),
      people: await count('SELECT COUNT(*) AS c FROM people WHERE published = 1'),
      feedback: await count("SELECT COUNT(*) AS c FROM feedback WHERE status = 'new'"),
      events: await count(`SELECT COUNT(*) AS c FROM events WHERE published = 1 AND starts_on >= '${todayBD()}'`),
      recent: req.user.role === 'admin' ? await q('SELECT action, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 8') : [],
    });
  });

  for (const m of ALL) m.mount?.({ pub, admin });
}
