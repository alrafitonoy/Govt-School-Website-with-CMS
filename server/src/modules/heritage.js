// History (text and photo albums) and Our Pride (notable alumni), shown under the About section.
import { q, one, parseJson } from '../core/db.js';
import { crudRouter } from '../core/crud.js';
import { bad, notFound, safeUrl } from '../core/util.js';
import { getContent, moduleOn } from '../core/moduleStore.js';

const withPhotos = (row) => ({ ...row, photos: parseJson(row.photos, []) });

function cleanPhotos(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 200).map((p) => {
    const url = safeUrl(p?.url);
    if (!url) throw bad('A photo in this album has no file.');
    return { url, thumb: p.thumb ? safeUrl(p.thumb) : null, caption: String(p.caption || '').trim().slice(0, 200) };
  });
}

// The newest photos across albums, for the home page.
export async function historyHomePhotos(limit) {
  const albums = await q('SELECT id, title, photos FROM history_albums WHERE published = 1 ORDER BY sort_order, id DESC LIMIT 30');
  const out = [];
  for (const a of albums) {
    for (const p of parseJson(a.photos, [])) {
      if (out.length >= limit) return out;
      out.push({ id: `${a.id}-${out.length}`, type: 'image', url: p.url, thumb: p.thumb, title: p.caption || a.title });
    }
  }
  return out;
}

export const history = {
  key: 'history',
  title: 'History',
  description: 'The history of the school with photo albums, highlighted on the home page.',
  group: 'Pages',
  home: true,
  adminPath: '/history',
  permissions: [{ key: 'history.manage', label: 'Edit the history and its albums' }],
  schema: [{ key: 'home_photos', label: 'Photos on the home page', type: 'number', default: 8, min: 4, max: 24, help: 'Shown in rows of 4 (2 on phones).' }],
  contentSchema: [
    { key: 'heading', label: 'Heading', type: 'text', max: 120 },
    { key: 'summary', label: 'Short summary for the home page', type: 'textarea', max: 600 },
    { key: 'body', label: 'Full history', type: 'html' },
  ],
  defaultContent: { heading: 'ইতিহাস', summary: '', body: '' },
  mount({ pub, admin }) {
    pub.get('/history', moduleOn('history'), async (req, res) => {
      const albums = await q('SELECT id, title, title_en, description, event_year, cover, photos FROM history_albums WHERE published = 1 ORDER BY sort_order, id DESC LIMIT 200');
      res.json({
        content: await getContent('history'),
        albums: albums.map(withPhotos).map(({ photos, ...a }) => ({ ...a, photo_count: photos.length, cover: a.cover || photos[0]?.thumb || photos[0]?.url || '' })),
      });
    });
    pub.get('/history/albums/:id', moduleOn('history'), async (req, res) => {
      const row = await one('SELECT id, title, title_en, description, event_year, photos FROM history_albums WHERE id = ? AND published = 1', [Number(req.params.id)]);
      if (!row) throw notFound('This album was not found.');
      res.json(withPhotos(row));
    });
    admin.use('/history/albums', moduleOn('history'), crudRouter({
      table: 'history_albums', label: 'album', perm: 'history.manage', orderBy: 'sort_order, id DESC',
      fields: [
        { key: 'title', label: 'Album title', type: 'text', required: true, max: 200 },
        { key: 'title_en', label: 'Title in English', type: 'text', max: 200 },
        { key: 'event_year', label: 'Year', type: 'text', max: 20 },
        { key: 'description', label: 'Description', type: 'textarea', max: 1000 },
        { key: 'cover', label: 'Cover image', type: 'image' },
        { key: 'sort_order', label: 'Order', type: 'number' },
        { key: 'published', type: 'switch' },
      ],
      beforeSave: async (data, req) => {
        data.photos = JSON.stringify(cleanPhotos(req.body?.photos));
        return data;
      },
    }));
  },
};

export const alumni = {
  key: 'alumni',
  title: 'Our Pride',
  description: 'Notable former students with their name, designation and photo.',
  group: 'Pages',
  adminPath: '/alumni',
  permissions: [{ key: 'alumni.manage', label: 'Manage Our Pride' }],
  mount({ pub, admin }) {
    pub.get('/alumni', moduleOn('alumni'), async (req, res) => {
      res.json({ items: await q('SELECT id, name, name_en, designation, designation_en, passing_year, about, photo FROM alumni WHERE published = 1 ORDER BY sort_order, id LIMIT 500') });
    });
    admin.use('/alumni', moduleOn('alumni'), crudRouter({
      table: 'alumni', label: 'alumnus', perm: 'alumni.manage', orderBy: 'sort_order, id',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, max: 150 },
        { key: 'name_en', label: 'Name in English', type: 'text', max: 150 },
        { key: 'designation', label: 'Designation', type: 'text', required: true, max: 200 },
        { key: 'designation_en', label: 'Designation in English', type: 'text', max: 200 },
        { key: 'passing_year', label: 'Passing year or batch', type: 'text', max: 40 },
        { key: 'about', label: 'About', type: 'textarea', max: 600 },
        { key: 'photo', label: 'Photo', type: 'image' },
        { key: 'sort_order', label: 'Order', type: 'number' },
        { key: 'published', type: 'switch' },
      ],
    }));
  },
};
