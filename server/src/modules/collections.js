import { q, one, parseJson } from '../core/db.js';
import { can } from '../core/auth.js';
import { crudRouter } from '../core/crud.js';
import { bad, cleanHtml, notFound, paging, safeUrl, todayBD } from '../core/util.js';
import { getConfig, moduleOn } from '../core/moduleStore.js';

const liveNotices = 'published = 1 AND notice_date <= ? AND (expires_on IS NULL OR expires_on >= ?)';

export async function latestNotices(limit) {
  const today = todayBD();
  const rows = await q(
    `SELECT id, title, category, notice_date, pinned, attachments FROM notices WHERE ${liveNotices} ORDER BY pinned DESC, notice_date DESC, id DESC LIMIT ?`,
    [today, today, limit],
  );
  return rows.map((n) => ({ ...n, attachments: parseJson(n.attachments, []) }));
}

function cleanAttachments(list, allowed) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 10).map((a) => {
    const url = safeUrl(a?.url);
    if (!url.startsWith('/uploads/')) throw bad('Attachments must be uploaded files.');
    const kind = a.kind === 'pdf' ? 'pdf' : 'image';
    if (kind === 'pdf' && !allowed.pdf) throw bad('PDF attachments are turned off in the Noticeboard settings.');
    if (kind === 'image' && !allowed.image) throw bad('Image attachments are turned off in the Noticeboard settings.');
    return { url, kind, name: String(a.name || '').slice(0, 200), thumb: a.thumb ? safeUrl(a.thumb) : null };
  });
}

export const notices = {
  key: 'notices',
  title: 'Noticeboard',
  description: 'Publish written notices with PDF, JPG, JPEG or PNG attachments.',
  group: 'Content',
  home: true,
  nav: { label: 'Notices', path: '/notices' },
  adminPath: '/notices',
  permissions: [{ key: 'notices.manage', label: 'Create and edit notices' }],
  schema: [
    { key: 'home_count', label: 'Notices shown on the home page', type: 'number', default: 5, min: 1, max: 20 },
    { key: 'page_size', label: 'Notices per page', type: 'number', default: 12, min: 5, max: 50 },
    { key: 'show_ticker', label: 'Show the latest-notice ticker on top of every page', type: 'switch', default: true },
    { key: 'allow_pdf', label: 'Allow PDF attachments', type: 'switch', default: true },
    { key: 'allow_images', label: 'Allow JPG, JPEG and PNG attachments', type: 'switch', default: true },
    { key: 'max_upload_mb', label: 'Largest attachment (MB)', type: 'number', default: 10, min: 1, max: 100 },
  ],
  publicConfig: ['show_ticker', 'page_size'],
  mount({ pub, admin }) {
    pub.get('/notices', moduleOn('notices'), async (req, res) => {
      const c = await getConfig('notices');
      const { limit, offset, page } = paging(req.query, 50, Number(c.page_size) || 12);
      const today = todayBD();
      const [{ total }] = await q(`SELECT COUNT(*) AS total FROM notices WHERE ${liveNotices}`, [today, today]);
      const rows = await q(
        `SELECT id, title, category, notice_date, pinned, attachments FROM notices WHERE ${liveNotices} ORDER BY pinned DESC, notice_date DESC, id DESC LIMIT ? OFFSET ?`,
        [today, today, limit, offset],
      );
      res.json({ items: rows.map((n) => ({ ...n, attachments: parseJson(n.attachments, []) })), total, page, limit });
    });

    pub.get('/notices/:id', moduleOn('notices'), async (req, res) => {
      const today = todayBD();
      const n = await one(`SELECT id, title, category, body, notice_date, pinned, attachments FROM notices WHERE id = ? AND ${liveNotices}`, [Number(req.params.id), today, today]);
      if (!n) throw notFound('This notice was not found or is no longer available.');
      res.json({ ...n, attachments: parseJson(n.attachments, []) });
    });

    admin.use('/notices', moduleOn('notices'), crudRouter({
      table: 'notices',
      label: 'notice',
      perm: 'notices.manage',
      orderBy: 'pinned DESC, notice_date DESC, id DESC',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, max: 255 },
        { key: 'category', label: 'Category', type: 'text', max: 80 },
        { key: 'notice_date', label: 'Notice date', type: 'date', required: true },
        { key: 'expires_on', label: 'Hide after', type: 'date' },
        { key: 'pinned', type: 'switch' },
        { key: 'published', type: 'switch' },
      ],
      beforeSave: async (data, req) => {
        const c = await getConfig('notices');
        data.body = cleanHtml(req.body?.body);
        data.attachments = JSON.stringify(cleanAttachments(req.body?.attachments, { pdf: c.allow_pdf, image: c.allow_images }));
        if (!data.body.trim() && data.attachments === '[]') throw bad('Write the notice or attach a file.');
        data.created_by = req.user.id;
        return data;
      },
    }));
  },
};

export const achievements = {
  key: 'achievements',
  title: 'Achievements',
  description: 'Awards, results and other milestones.',
  group: 'Content',
  home: true,
  nav: { label: 'Achievements', path: '/achievements' },
  adminPath: '/achievements',
  permissions: [{ key: 'achievements.manage', label: 'Manage achievements' }],
  schema: [{ key: 'home_count', label: 'Shown on the home page', type: 'number', default: 3, min: 1, max: 12 }],
  mount({ pub, admin }) {
    pub.get('/achievements', moduleOn('achievements'), async (req, res) => {
      res.json({ items: await q('SELECT id, title, year, category, description, image FROM achievements WHERE published = 1 ORDER BY sort_order, year DESC, id DESC LIMIT 200') });
    });
    admin.use('/achievements', moduleOn('achievements'), crudRouter({
      table: 'achievements', label: 'achievement', perm: 'achievements.manage', orderBy: 'sort_order, year DESC, id DESC',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, max: 255 },
        { key: 'year', label: 'Year', type: 'text', max: 20 },
        { key: 'category', label: 'Category', type: 'text', max: 80 },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'image', label: 'Image', type: 'image' },
        { key: 'sort_order', label: 'Order', type: 'number' },
        { key: 'published', type: 'switch' },
      ],
    }));
  },
};

// Accepts every common YouTube link form and keeps only the 11-character video id.
export function youtubeId(url) {
  const m = String(url).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

export const gallery = {
  key: 'gallery',
  title: 'Media & Gallery',
  description: 'Photos and videos. Videos can be YouTube links or self-hosted files.',
  group: 'Content',
  home: true,
  nav: { label: 'Gallery', path: '/gallery' },
  adminPath: '/gallery',
  permissions: [{ key: 'gallery.manage', label: 'Manage the gallery' }],
  schema: [
    { key: 'home_count', label: 'Items shown on the home page', type: 'number', default: 6, min: 1, max: 24 },
    { key: 'allow_self_hosted_video', label: 'Allow self-hosted video uploads', type: 'switch', default: true },
  ],
  mount({ pub, admin }) {
    pub.get('/gallery', moduleOn('gallery'), async (req, res) => {
      res.json({ items: await q('SELECT id, type, title, album, url, thumb FROM gallery_items WHERE published = 1 ORDER BY sort_order, id DESC LIMIT 500') });
    });
    admin.use('/gallery', moduleOn('gallery'), crudRouter({
      table: 'gallery_items', label: 'gallery', perm: 'gallery.manage', orderBy: 'sort_order, id DESC',
      fields: [
        { key: 'type', label: 'Type', type: 'select', required: true, options: ['image', 'youtube', 'video'] },
        { key: 'title', label: 'Title', type: 'text', max: 255 },
        { key: 'album', label: 'Album', type: 'text', max: 80 },
        { key: 'url', label: 'File or link', type: 'url', required: true },
        { key: 'thumb', label: 'Thumbnail', type: 'image' },
        { key: 'sort_order', label: 'Order', type: 'number' },
        { key: 'published', type: 'switch' },
      ],
      beforeSave: async (data) => {
        if (data.type === 'youtube') {
          const id = youtubeId(data.url);
          if (!id) throw bad('That does not look like a YouTube video link.');
          data.url = `https://www.youtube.com/watch?v=${id}`;
          data.thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        } else if (!data.url.startsWith('/uploads/')) {
          throw bad('Upload the file first.');
        } else if (data.type === 'video' && !(await getConfig('gallery')).allow_self_hosted_video) {
          throw bad('Self-hosted videos are turned off in the Gallery settings.');
        }
        return data;
      },
    }));
  },
};

// Items with a count of zero never reach the public site, however they are configured.
export const publicFacilities = () => q(
  "SELECT id, name, kind, category, quantity, description, icon, image FROM facilities WHERE published = 1 AND (kind = 'feature' OR quantity > 0) ORDER BY sort_order, id",
);

export const facilities = {
  key: 'facilities',
  title: 'Facilities',
  description: 'Classrooms, labs, playground and more. Anything with a count of zero stays hidden.',
  group: 'Content',
  home: true,
  nav: { label: 'Facilities', path: '/facilities' },
  adminPath: '/facilities',
  permissions: [{ key: 'facilities.manage', label: 'Manage facilities' }],
  mount({ pub, admin }) {
    pub.get('/facilities', moduleOn('facilities'), async (req, res) => res.json({ items: await publicFacilities() }));
    admin.use('/facilities', moduleOn('facilities'), crudRouter({
      table: 'facilities', label: 'facility', perm: 'facilities.manage', orderBy: 'sort_order, id',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, max: 120 },
        { key: 'kind', label: 'Type', type: 'select', required: true, options: ['count', 'feature'] },
        { key: 'category', label: 'Category', type: 'text', max: 60 },
        { key: 'quantity', label: 'Number', type: 'number', min: 0, max: 100000 },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'icon', label: 'Icon', type: 'text', max: 40 },
        { key: 'image', label: 'Image', type: 'image' },
        { key: 'sort_order', label: 'Order', type: 'number' },
        { key: 'published', type: 'switch' },
      ],
    }));
  },
};

const RESERVED_SLUGS = ['admin', 'api', 'uploads', 'notices', 'results', 'about', 'message', 'achievements', 'gallery', 'facilities', 'admission', 'contact', 'payment', 'pages'];

export const pages = {
  key: 'pages',
  title: 'Custom Pages',
  description: 'Create any extra page, such as Rules, Teachers or Syllabus, and add it to the menu.',
  group: 'Content',
  adminPath: '/pages',
  permissions: [{ key: 'pages.manage', label: 'Manage custom pages' }],
  mount({ pub, admin }) {
    pub.get('/pages/:slug', moduleOn('pages'), async (req, res) => {
      const p = await one('SELECT slug, title, body, seo_description FROM pages WHERE slug = ? AND published = 1', [String(req.params.slug)]);
      if (!p) throw notFound('Page not found.');
      res.json(p);
    });
    admin.use('/pages', moduleOn('pages'), crudRouter({
      table: 'pages', label: 'page', perm: 'pages.manage', orderBy: 'sort_order, title',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, max: 255 },
        { key: 'slug', label: 'Web address', type: 'text', max: 120 },
        { key: 'body', label: 'Content', type: 'html' },
        { key: 'seo_description', label: 'Search description', type: 'text', max: 300 },
        { key: 'in_nav', type: 'switch' },
        { key: 'sort_order', label: 'Order', type: 'number' },
        { key: 'published', type: 'switch' },
      ],
      beforeSave: async (data, req) => {
        const slug = (data.slug || data.title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 120);
        if (!slug) throw bad('Please give the page a web address.');
        if (RESERVED_SLUGS.includes(slug)) throw bad(`"${slug}" is reserved. Choose another web address.`);
        const clash = await one('SELECT id FROM pages WHERE slug = ? AND id <> ?', [slug, Number(req.params.id) || 0]);
        if (clash) throw bad('Another page already uses that web address.');
        data.slug = slug;
        return data;
      },
    }));
  },
};
