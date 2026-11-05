// The modules behind the portal menu: people, departments, events, news, publications, activities and feedback.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { q, one } from '../core/db.js';
import { can } from '../core/auth.js';
import { crudRouter } from '../core/crud.js';
import { audit, bad, cleanHtml, escapeLike, notFound, paging, todayBD } from '../core/util.js';
import { getConfig, moduleOn } from '../core/moduleStore.js';

const PERSON_SORTS = { default: 'p.sort_order, p.id', name: 'p.name', designation: 'p.designation, p.name', education: 'p.education, p.name', email: 'p.email, p.name', phone: 'p.phone_office, p.name', intercom: 'p.intercom, p.name', fax: 'p.fax, p.name' };
const PERSON_TYPES = ['officer', 'teacher', 'staff', 'information'];
const PERSON_COLUMNS = 'p.id, p.type, p.name, p.name_en, p.designation, p.education, p.department_id, p.photo, p.phone_office, p.intercom, p.phone_home, p.fax, p.email, p.mobile, p.room, p.cv, d.name AS department, d.name_en AS department_en, d.faculty';

const isoDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null);
const publishedField = { key: 'published', type: 'switch' };
const orderField = { key: 'sort_order', label: 'Order', type: 'number' };

export const people = {
  key: 'people',
  title: 'Teachers & Staff',
  description: 'Officers, teachers, staff and the information officer, with card and table views.',
  group: 'Institution',
  adminPath: '/people',
  permissions: [{ key: 'people.manage', label: 'Manage officers, teachers and staff' }],
  schema: [
    { key: 'show_home_phone', label: 'Show home phone numbers publicly', type: 'switch', default: false, help: 'Off by default, because these are personal numbers.' },
    { key: 'show_mobile', label: 'Show mobile numbers publicly', type: 'switch', default: true },
    { key: 'default_page_size', label: 'People per page', type: 'number', default: 20, min: 10, max: 100 },
  ],
  publicConfig: ['default_page_size'],
  mount({ pub, admin }) {
    const privacy = async (rows) => {
      const c = await getConfig('people');
      return rows.map((r) => ({ ...r, phone_home: c.show_home_phone ? r.phone_home : null, mobile: c.show_mobile ? r.mobile : null }));
    };

    pub.get('/people', moduleOn('people'), async (req, res) => {
      const { limit, offset, page } = paging(req.query, 100, 20);
      const where = ['p.published = 1'];
      const params = [];
      if (PERSON_TYPES.includes(req.query.type)) { where.push('p.type = ?'); params.push(req.query.type); }
      if (req.query.department_id) { where.push('p.department_id = ?'); params.push(Number(req.query.department_id)); }
      const term = String(req.query.q || '').trim().slice(0, 80);
      if (term) {
        const like = `%${escapeLike(term)}%`;
        where.push('(p.name LIKE ? OR p.name_en LIKE ? OR p.designation LIKE ? OR p.email LIKE ?)');
        params.push(like, like, like, like);
      }
      const clause = where.join(' AND ');
      const [{ total }] = await q(`SELECT COUNT(*) AS total FROM people p WHERE ${clause}`, params);
      const sort = PERSON_SORTS[req.query.sort] || PERSON_SORTS.default;
      const rows = await q(`SELECT ${PERSON_COLUMNS} FROM people p LEFT JOIN departments d ON d.id = p.department_id WHERE ${clause} ORDER BY ${sort} LIMIT ? OFFSET ?`, [...params, limit, offset]);
      res.json({ items: await privacy(rows), total, page, limit });
    });

    pub.get('/people/:id', moduleOn('people'), async (req, res) => {
      const row = await one(`SELECT ${PERSON_COLUMNS}, p.bio FROM people p LEFT JOIN departments d ON d.id = p.department_id WHERE p.id = ? AND p.published = 1`, [Number(req.params.id)]);
      if (!row) throw notFound('This person was not found.');
      res.json((await privacy([row]))[0]);
    });

    admin.use('/people', moduleOn('people'), crudRouter({
      table: 'people', label: 'person', perm: 'people.manage', orderBy: 'type, sort_order, id',
      fields: [
        { key: 'type', label: 'Type', type: 'select', required: true, options: PERSON_TYPES },
        { key: 'name', label: 'Name', type: 'text', required: true, max: 150 },
        { key: 'name_en', label: 'Name in English', type: 'text', max: 150 },
        { key: 'designation', label: 'Designation', type: 'text', max: 150 },
        { key: 'education', label: 'Education', type: 'text', max: 255 },
        { key: 'department_id', label: 'Department', type: 'number', nullable: true },
        { key: 'photo', label: 'Photo', type: 'image' },
        { key: 'phone_office', label: 'Office phone', type: 'text', max: 40 },
        { key: 'intercom', label: 'Intercom', type: 'text', max: 20 },
        { key: 'phone_home', label: 'Home phone', type: 'text', max: 40 },
        { key: 'fax', label: 'Fax', type: 'text', max: 40 },
        { key: 'email', label: 'Email', type: 'text', max: 190 },
        { key: 'mobile', label: 'Mobile', type: 'text', max: 40 },
        { key: 'room', label: 'Room number', type: 'text', max: 40 },
        { key: 'cv', label: 'CV file', type: 'url' },
        { key: 'bio', label: 'Biography', type: 'html' },
        orderField,
        publishedField,
      ],
      beforeSave: async (data) => {
        if (data.department_id && !(await one('SELECT id FROM departments WHERE id = ?', [data.department_id]))) throw bad('That department no longer exists.');
        return data;
      },
    }));
  },
};

export const departments = {
  key: 'departments',
  title: 'Departments',
  description: 'Departments and faculties, each listing its teachers.',
  group: 'Institution',
  adminPath: '/departments',
  permissions: [{ key: 'departments.manage', label: 'Manage departments' }],
  mount({ pub, admin }) {
    pub.get('/departments', moduleOn('departments'), async (req, res) => {
      const items = await q(`SELECT d.id, d.name, d.name_en, d.faculty, d.description, d.image, COUNT(p.id) AS people_count
        FROM departments d LEFT JOIN people p ON p.department_id = d.id AND p.published = 1
        WHERE d.published = 1 GROUP BY d.id ORDER BY d.sort_order, d.name`);
      res.json({ items });
    });
    pub.get('/departments/:id', moduleOn('departments'), async (req, res) => {
      const row = await one('SELECT id, name, name_en, faculty, description, image FROM departments WHERE id = ? AND published = 1', [Number(req.params.id)]);
      if (!row) throw notFound('This department was not found.');
      res.json(row);
    });
    admin.use('/departments', moduleOn('departments'), crudRouter({
      table: 'departments', label: 'department', perm: 'departments.manage', orderBy: 'sort_order, name',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, max: 150 },
        { key: 'name_en', label: 'Name in English', type: 'text', max: 150 },
        { key: 'faculty', label: 'Faculty', type: 'text', max: 120 },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'image', label: 'Image', type: 'image' },
        orderField,
        publishedField,
      ],
    }));
  },
};

export const events = {
  key: 'events',
  title: 'Meeting Calendar',
  description: 'Meetings and events, shown on the home page calendar.',
  group: 'Institution',
  adminPath: '/events',
  permissions: [{ key: 'events.manage', label: 'Manage the calendar' }],
  mount({ pub, admin }) {
    pub.get('/events', moduleOn('events'), async (req, res) => {
      const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : null;
      const date = isoDate(req.query.date);
      const columns = 'id, title, starts_on, ends_on, time_text, location, description';
      let items;
      if (month) {
        // An event that spans months appears in each of them.
        const first = `${month}-01`;
        items = await q(`SELECT ${columns} FROM events WHERE published = 1 AND starts_on <= LAST_DAY(?) AND COALESCE(ends_on, starts_on) >= ? ORDER BY starts_on LIMIT 200`, [first, first]);
      } else if (date) {
        items = await q(`SELECT ${columns} FROM events WHERE published = 1 AND starts_on <= ? AND COALESCE(ends_on, starts_on) >= ? ORDER BY starts_on LIMIT 100`, [date, date]);
      } else {
        const today = todayBD();
        const upcoming = await q(`SELECT ${columns} FROM events WHERE published = 1 AND COALESCE(ends_on, starts_on) >= ? ORDER BY starts_on LIMIT 100`, [today]);
        const past = await q(`SELECT ${columns} FROM events WHERE published = 1 AND COALESCE(ends_on, starts_on) < ? ORDER BY starts_on DESC LIMIT 50`, [today]);
        return res.json({ items: upcoming, past });
      }
      res.json({ items });
    });
    admin.use('/events', moduleOn('events'), crudRouter({
      table: 'events', label: 'event', perm: 'events.manage', orderBy: 'starts_on DESC, id DESC',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, max: 255 },
        { key: 'starts_on', label: 'Date', type: 'date', required: true },
        { key: 'ends_on', label: 'End date', type: 'date' },
        { key: 'time_text', label: 'Time', type: 'text', max: 60 },
        { key: 'location', label: 'Place', type: 'text', max: 190 },
        { key: 'description', label: 'Details', type: 'html' },
        publishedField,
      ],
      beforeSave: async (data) => {
        if (data.ends_on && data.ends_on < data.starts_on) throw bad('The end date cannot be before the start date.');
        return data;
      },
    }));
  },
};

const liveNews = 'published = 1 AND news_date <= ? AND (expires_on IS NULL OR expires_on >= ?)';

export async function latestNews(limit) {
  const today = todayBD();
  return q(`SELECT id, title, news_date, external_link FROM news WHERE ${liveNews} ORDER BY news_date DESC, id DESC LIMIT ?`, [today, today, limit]);
}

export const news = {
  key: 'news',
  title: 'News',
  description: 'Short news items that scroll in the "খবর" strip on the home page.',
  group: 'Content',
  home: true,
  adminPath: '/news',
  permissions: [{ key: 'news.manage', label: 'Manage news' }],
  schema: [{ key: 'home_count', label: 'Items in the home page strip', type: 'number', default: 5, min: 1, max: 20 }],
  mount({ pub, admin }) {
    pub.get('/news', moduleOn('news'), async (req, res) => {
      const { limit, offset, page } = paging(req.query, 50, 20);
      const today = todayBD();
      const [{ total }] = await q(`SELECT COUNT(*) AS total FROM news WHERE ${liveNews}`, [today, today]);
      const items = await q(`SELECT id, title, news_date, image, external_link FROM news WHERE ${liveNews} ORDER BY news_date DESC, id DESC LIMIT ? OFFSET ?`, [today, today, limit, offset]);
      res.json({ items, total, page, limit });
    });
    pub.get('/news/:id', moduleOn('news'), async (req, res) => {
      const today = todayBD();
      const row = await one(`SELECT id, title, news_date, body, image, external_link FROM news WHERE id = ? AND ${liveNews}`, [Number(req.params.id), today, today]);
      if (!row) throw notFound('This news item was not found.');
      res.json(row);
    });
    admin.use('/news', moduleOn('news'), crudRouter({
      table: 'news', label: 'news', perm: 'news.manage', orderBy: 'news_date DESC, id DESC',
      fields: [
        { key: 'title', label: 'Headline', type: 'text', required: true, max: 255 },
        { key: 'news_date', label: 'Date', type: 'date', required: true },
        { key: 'expires_on', label: 'Hide after', type: 'date' },
        { key: 'external_link', label: 'Link', type: 'url' },
        { key: 'image', label: 'Image', type: 'image' },
        { key: 'body', label: 'Details', type: 'html' },
        publishedField,
      ],
    }));
  },
};

export const publications = {
  key: 'publications',
  title: 'Publications',
  description: 'Syllabus, class routine, forms, magazines and other downloads.',
  group: 'Institution',
  adminPath: '/publications',
  permissions: [{ key: 'publications.manage', label: 'Manage publications' }],
  mount({ pub, admin }) {
    pub.get('/publications', moduleOn('publications'), async (req, res) => {
      const { limit, offset, page } = paging(req.query, 100, 20);
      const where = ['published = 1'];
      const params = [];
      if (req.query.category) { where.push('category = ?'); params.push(String(req.query.category).slice(0, 80)); }
      const term = String(req.query.q || '').trim().slice(0, 80);
      if (term) { where.push('(title LIKE ? OR description LIKE ?)'); params.push(`%${escapeLike(term)}%`, `%${escapeLike(term)}%`); }
      const clause = where.join(' AND ');
      const [{ total }] = await q(`SELECT COUNT(*) AS total FROM publications WHERE ${clause}`, params);
      const items = await q(`SELECT id, title, category, pub_date, description, file FROM publications WHERE ${clause} ORDER BY sort_order, pub_date DESC, id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
      const categories = (await q("SELECT DISTINCT category FROM publications WHERE published = 1 AND category IS NOT NULL AND category <> '' ORDER BY category")).map((r) => r.category);
      res.json({ items, categories, total, page, limit });
    });
    admin.use('/publications', moduleOn('publications'), crudRouter({
      table: 'publications', label: 'publication', perm: 'publications.manage', orderBy: 'sort_order, pub_date DESC, id DESC',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, max: 255 },
        { key: 'category', label: 'Category', type: 'text', max: 80 },
        { key: 'pub_date', label: 'Date', type: 'date' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'file', label: 'File', type: 'url', required: true },
        orderField,
        publishedField,
      ],
    }));
  },
};

export const activities = {
  key: 'activities',
  title: 'Co-curricular Activities',
  description: 'Clubs, sports, cultural programmes and other activities.',
  group: 'Institution',
  adminPath: '/activities',
  permissions: [{ key: 'activities.manage', label: 'Manage activities and clubs' }],
  mount({ pub, admin }) {
    pub.get('/activities', moduleOn('activities'), async (req, res) => {
      res.json({ items: await q('SELECT id, title, category, advisor, schedule, description, image FROM activities WHERE published = 1 ORDER BY sort_order, title LIMIT 200') });
    });
    admin.use('/activities', moduleOn('activities'), crudRouter({
      table: 'activities', label: 'activity', perm: 'activities.manage', orderBy: 'sort_order, title',
      fields: [
        { key: 'title', label: 'Name', type: 'text', required: true, max: 255 },
        { key: 'category', label: 'Category', type: 'text', max: 80 },
        { key: 'advisor', label: 'Teacher in charge', type: 'text', max: 150 },
        { key: 'schedule', label: 'When', type: 'text', max: 150 },
        { key: 'image', label: 'Image', type: 'image' },
        { key: 'description', label: 'Description', type: 'html' },
        orderField,
        publishedField,
      ],
    }));
  },
};

const feedbackLimit = rateLimit({
  windowMs: 60 * 60_000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many messages from this connection. Please try again later.' },
});

export const feedback = {
  key: 'feedback',
  title: 'Feedback',
  defaultEnabled: false,
  description: 'Messages from the "আপনার মতামত প্রদান করুন" form.',
  group: 'Institution',
  adminPath: '/feedback',
  permissions: [{ key: 'feedback.manage', label: 'Read and manage feedback' }],
  mount({ pub, admin }) {
    pub.post('/feedback', moduleOn('feedback'), feedbackLimit, async (req, res) => {
      const b = req.body || {};
      // Honeypot: real visitors never see this field, so a value means a bot. Pretend all is well.
      if (b.website) return res.status(201).json({ ok: true });
      const fields = {};
      const name = String(b.name || '').trim().slice(0, 150);
      const message = String(b.message || '').trim().slice(0, 5000);
      const email = String(b.email || '').trim().slice(0, 190);
      if (!name) fields.name = 'Name is required.';
      if (message.length < 5) fields.message = 'Please write your message.';
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Enter a valid email address.';
      if (Object.keys(fields).length) throw bad('Please correct the highlighted fields.', fields);
      await q('INSERT INTO feedback (name, email, mobile, subject, message, page, ip) VALUES (?,?,?,?,?,?,?)', [
        name, email || null, String(b.mobile || '').trim().slice(0, 30) || null, String(b.subject || '').trim().slice(0, 200) || null,
        message, String(b.page || '').slice(0, 200) || null, req.ip,
      ]);
      res.status(201).json({ ok: true });
    });

    const r = Router();
    r.use(moduleOn('feedback'), can('feedback.manage'));
    r.get('/', async (req, res) => {
      const { limit, offset, page } = paging(req.query, 100, 25);
      const status = ['new', 'read', 'closed'].includes(req.query.status) ? req.query.status : null;
      const where = status ? 'WHERE status = ?' : '';
      const params = status ? [status] : [];
      const [{ total }] = await q(`SELECT COUNT(*) AS total FROM feedback ${where}`, params);
      const items = await q(`SELECT id, name, email, mobile, subject, message, page, status, notes, created_at FROM feedback ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
      res.json({ items, total, page, limit });
    });
    r.put('/:id', async (req, res) => {
      if (!['new', 'read', 'closed'].includes(req.body?.status)) throw bad('Choose a valid status.');
      await q('UPDATE feedback SET status = ?, notes = ? WHERE id = ?', [req.body.status, String(req.body.notes || '').slice(0, 2000), Number(req.params.id)]);
      await audit(req, 'feedback.update', req.params.id);
      res.json({ ok: true });
    });
    r.delete('/:id', async (req, res) => {
      await q('DELETE FROM feedback WHERE id = ?', [Number(req.params.id)]);
      await audit(req, 'feedback.delete', req.params.id);
      res.json({ ok: true });
    });
    admin.use('/feedback', r);
  },
};
