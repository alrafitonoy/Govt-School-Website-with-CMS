// The government-portal style layout: everything around the page content is editable here.
// A link left empty shows as plain text, ready for the school to fill in later.
import { getContent, saveRawContent } from '../core/moduleStore.js';
import { q, one } from '../core/db.js';

const link = (label, url = '') => ({ label, label_en: '', link: url, group: '' });
const block = (title, title_en, links) => ({ title, title_en, links });

const linkFields = [
  { key: 'label', label: 'Text (Bangla)', type: 'text', max: 120 },
  { key: 'label_en', label: 'Text (English)', type: 'text', max: 120 },
  { key: 'link', label: 'Link', type: 'url' },
];

// Fills links the admin has left empty and adds new default items, without touching anything they changed.
// Items are matched on `title` (boxes) or `label` (links and menu items), never on a field they lack.
export function fillLinks(saved = [], defaults = []) {
  for (const d of defaults) {
    const key = d.title ? 'title' : 'label';
    const s = saved.find((x) => x[key] === d[key]);
    if (!s) {
      saved.push(d);
      continue;
    }
    if (d.link && !s.link) s.link = d.link;
    if (d.links) s.links = fillLinks(s.links, d.links);
  }
  return saved;
}

const LAYOUT_VERSION = '3';
const REMOVED_BLOCKS = ['পোর্টাল', 'অভিধান', 'ওয়েব মেইল'];

// Runs once per site, so items an admin deletes afterwards stay deleted.
export async function upgradePortalContent() {
  const row = await one("SELECT v FROM settings WHERE k = 'portal_layout_version'");
  if (row?.v === LAYOUT_VERSION) return;
  const content = await getContent('portal');
  const d = portal.defaultContent;
  // Version 3: the publications menu becomes a single notices link, and feedback links and three boxes go.
  for (const m of content.menu || []) {
    if (m.label === 'প্রকাশনা') Object.assign(m, { label: 'নোটিশ', label_en: 'Notices', link: '/notices', links: [] });
    m.links = (m.links || []).filter((l) => l.link !== '/feedback');
  }
  content.sidebar_blocks = (content.sidebar_blocks || []).filter((b) => !REMOVED_BLOCKS.includes(b.title));
  await q("UPDATE modules SET enabled = 0 WHERE mkey = 'feedback'");
  const site = await getContent('site');
  if (site.brand_color) await saveRawContent('site', { ...site, brand_color: '' });
  await saveRawContent('portal', {
    ...content,
    menu: fillLinks(content.menu, d.menu),
    service_boxes: fillLinks(content.service_boxes, d.service_boxes),
    sidebar_blocks: fillLinks(content.sidebar_blocks, d.sidebar_blocks),
  });
  await q("INSERT INTO settings (k, v) VALUES ('portal_layout_version', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [LAYOUT_VERSION]);
}

export const portal = {
  key: 'portal',
  title: 'Portal Layout',
  description: 'Main menu, home page boxes, sidebar boxes, hotlines, background and national anthem.',
  group: 'Site',
  locked: true,
  permissions: [{ key: 'portal.manage', label: 'Edit the menu and sidebar' }],
  contentSchema: [
    {
      key: 'menu', label: 'Main menu', type: 'list', section: 'Main menu',
      fields: [
        ...linkFields,
        {
          key: 'links', label: 'Dropdown items', type: 'list',
          fields: [{ key: 'group', label: 'Column heading', type: 'text', max: 120 }, ...linkFields],
        },
      ],
    },
    {
      key: 'service_boxes', label: 'Home page boxes', type: 'list', section: 'Home page',
      fields: [
        { key: 'title', label: 'Title (Bangla)', type: 'text', max: 120 },
        { key: 'title_en', label: 'Title (English)', type: 'text', max: 120 },
        { key: 'image', label: 'Icon image', type: 'image' },
        { key: 'links', label: 'Links', type: 'list', fields: linkFields },
      ],
    },
    { key: 'video_url', label: 'YouTube video link', type: 'url', section: 'Home page', help: 'Shown above the map from School Identity.' },
    {
      key: 'sidebar_blocks', label: 'Sidebar boxes', type: 'list', section: 'Sidebar',
      fields: [
        { key: 'title', label: 'Title (Bangla)', type: 'text', max: 120 },
        { key: 'title_en', label: 'Title (English)', type: 'text', max: 120 },
        { key: 'links', label: 'Links', type: 'list', fields: linkFields },
      ],
    },
    { key: 'calendar_title', label: 'Calendar title', type: 'text', max: 80, section: 'Sidebar' },
    { key: 'anthem_audio', label: 'National anthem audio', type: 'image', purpose: 'audio', section: 'Sidebar', help: 'MP3 file. The box stays hidden until a file is added.' },
    {
      key: 'hotlines', label: 'Emergency hotlines', type: 'list', section: 'Sidebar',
      fields: [
        { key: 'label', label: 'Name (Bangla)', type: 'text', max: 120 },
        { key: 'label_en', label: 'Name (English)', type: 'text', max: 120 },
        { key: 'number', label: 'Number', type: 'text', max: 20 },
      ],
    },
    { key: 'background', label: 'Page background image', type: 'image', purpose: 'image', section: 'Appearance', help: 'Repeats down both sides of the page on wide screens.' },
  ],
  defaultContent: {
    menu: [
      {
        label: 'প্রতিষ্ঠান সম্পর্কে', label_en: 'About', link: '',
        links: [
          { group: 'প্রতিষ্ঠান সম্পর্কিত', label: 'এক নজরে', label_en: 'At a glance', link: '/about' },
          { group: 'প্রতিষ্ঠান সম্পর্কিত', label: 'ইতিহাস', label_en: 'History', link: '/history' },
          { group: 'প্রতিষ্ঠান সম্পর্কিত', label: 'আমাদের গর্ব', label_en: 'Our Pride', link: '/our-pride' },
          { group: 'প্রতিষ্ঠান সম্পর্কিত', label: 'কৃতিত্ব', label_en: 'Achievements', link: '/achievements' },
          { group: 'প্রতিষ্ঠান সম্পর্কিত', label: 'সুযোগ-সুবিধা', label_en: 'Facilities', link: '/facilities' },
          { group: 'প্রশাসন', label: 'প্রতিষ্ঠান প্রধান / অধ্যক্ষ', label_en: 'Head Teacher', link: '/message' },
          { group: 'শিক্ষক-কর্মকর্তা-কর্মচারী', label: 'কর্মকর্তাবৃন্দ', label_en: 'Officers', link: '/officers' },
          { group: 'শিক্ষক-কর্মকর্তা-কর্মচারী', label: 'শিক্ষকবৃন্দ', label_en: 'Teachers', link: '/teachers' },
          { group: 'শিক্ষক-কর্মকর্তা-কর্মচারী', label: 'কর্মচারীবৃন্দ', label_en: 'Staff', link: '/staff' },
          { group: 'শিক্ষক-কর্মকর্তা-কর্মচারী', label: 'তথ্য প্রদানকারী কর্মকর্তা', label_en: 'Information officer', link: '/information-officer' },
        ],
      },
      {
        label: 'পাঠ্যক্রম সম্পর্কে', label_en: 'Curriculum', link: '',
        links: [
          { group: 'পাঠ্যক্রম', label: 'সিলেবাস', label_en: 'Syllabus', link: '/publications?category=সিলেবাস' },
          { group: 'পাঠ্যক্রম', label: 'ক্লাস রুটিন', label_en: 'Class routine', link: '/publications?category=ক্লাস রুটিন' },
          { group: 'পাঠ্যক্রম', label: 'একাডেমিক ক্যালেন্ডার', label_en: 'Academic calendar', link: '/events' },
        ],
      },
      { label: 'বিভাগসমূহ', label_en: 'Departments', link: '/departments', links: [] },
      { label: 'সহশিক্ষা কার্যক্রম', label_en: 'Co-curricular', link: '/activities', links: [] },
      {
        label: 'ই-সেবা', label_en: 'E-services', link: '',
        links: [
          { group: 'ফলাফল', label: 'ফলাফল দেখুন', label_en: 'View results', link: '/results' },
          { group: 'ভর্তি', label: 'ভর্তি ফর্ম', label_en: 'Admission form', link: '/admission' },
          { group: 'ভর্তি', label: 'আবেদনের অবস্থা', label_en: 'Application status', link: '/admission/status' },
        ],
      },
      { label: 'নোটিশ', label_en: 'Notices', link: '/notices', links: [] },
      { label: 'গ্যালারি', label_en: 'Gallery', link: '/gallery', links: [] },
      { label: 'যোগাযোগ', label_en: 'Contact', link: '/contact', links: [] },
    ],
    service_boxes: [{
      title: 'আমাদের বিষয়ে', title_en: 'About us', image: '',
      links: [
        link('পটভূমি', '/about'), link('ইতিহাস', '/history'), link('আমাদের গর্ব', '/our-pride'), link('কর্মকর্তাবৃন্দ', '/officers'), link('সাংগঠনিক কাঠামো'), link('কার্যাবলী', '/activities'),
      ],
    }],
    video_url: '',
    sidebar_blocks: [
      block('ভর্তি ও ফর্ম ফিলাপ', 'Admission and forms', [link('ভর্তি ফর্ম', '/admission'), link('আবেদনের অবস্থা', '/admission/status'), link('অন্যান্য তথ্য', '/publications')]),
      block('ক্লাব', 'Clubs', [link('ডিভেটিং ক্লাব', '/activities'), link('সাইন্স ক্লাব', '/activities'), link('কম্পিউটার ক্লাব', '/activities'), link('রক্তদান ক্লাব', '/activities'), link('সাংস্কৃতিক ক্লাব', '/activities')]),
      block('মুক্তপাঠ', 'Muktopaath', [link('মুক্তপাঠ', 'https://www.muktopaath.gov.bd')]),
      block('মাইগভ', 'MyGov', [link('মাইগভের সেবা সমূহ', 'https://www.mygov.bd')]),
      block('জেলা ব্র্যান্ডিং', 'District branding', [link('জেলা ব্র্যান্ডিং')]),
      block('বিনিয়োগ শিক্ষা কার্যক্রম', 'Investment education', [link('ওয়েবসাইট লিংক'), link('ইউটিউব লিংক')]),
    ],
    calendar_title: 'সভার ক্যালেন্ডার',
    anthem_audio: '',
    hotlines: [
      { label: 'সরকারি তথ্য ও সেবা', label_en: 'Government information', number: '৩৩৩' },
      { label: 'জরুরি সেবা', label_en: 'Emergency services', number: '৯৯৯' },
      { label: 'ফায়ার সার্ভিস হটলাইন', label_en: 'Fire service', number: '১০২' },
      { label: 'নারী ও শিশু নির্যাতন প্রতিরোধ', label_en: 'Violence against women and children', number: '১০৯' },
      { label: 'চাইল্ড হেল্পলাইন', label_en: 'Child helpline', number: '১০৯৮' },
      { label: 'দুদক হটলাইন', label_en: 'Anti-corruption', number: '১০৬' },
    ],
    background: '',
  },
};
