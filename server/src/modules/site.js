// Site identity, home hero, head teacher's message, about, contact. Mostly schema-driven content.
const social = { key: 'socials', label: 'Social links', type: 'list', fields: [
  { key: 'label', label: 'Name (e.g. Facebook)', type: 'text' },
  { key: 'url', label: 'Link', type: 'url' },
] };

export const site = {
  key: 'site',
  title: 'School Identity',
  description: 'School name, logo, favicon, contact information and brand colour.',
  group: 'Site',
  locked: true,
  permissions: [{ key: 'site.manage', label: 'Edit school identity and contact information' }],
  contentSchema: [
    { key: 'school_name', label: 'School name', type: 'text', required: true, max: 200 },
    { key: 'school_name_bn', label: 'School name in Bangla', type: 'text', max: 200 },
    { key: 'short_name', label: 'Short name', type: 'text', max: 40 },
    { key: 'tagline', label: 'Motto or tagline', type: 'text', max: 200 },
    { key: 'logo', label: 'Logo', type: 'image', purpose: 'logo' },
    { key: 'favicon', label: 'Favicon', type: 'image', purpose: 'favicon' },
    { key: 'brand_color', label: 'Primary colour', type: 'color', help: 'Leave as navy blue unless you need another colour.' },
    { key: 'secondary_color', label: 'Secondary colour', type: 'color' },
    { key: 'established', label: 'Established (year)', type: 'text', max: 10 },
    { key: 'eiin', label: 'EIIN number', type: 'text', max: 20 },
    { key: 'board', label: 'Education board', type: 'text', max: 80 },
    { key: 'address', label: 'Address', type: 'textarea', max: 400 },
    { key: 'phone', label: 'Phone', type: 'text', max: 60 },
    { key: 'email', label: 'Email', type: 'text', max: 190 },
    { key: 'office_hours', label: 'Office hours', type: 'text', max: 120 },
    { key: 'map_embed', label: 'Google Maps embed link', type: 'map_embed', help: 'In Google Maps: Share > Embed a map > copy HTML, then paste it here.' },
    social,
    { key: 'footer_text', label: 'Footer text', type: 'text', max: 300 },
  ],
  defaultContent: { school_name: 'Your School Name', tagline: 'Knowledge. Character. Future.', socials: [] },
};

export const hero = {
  key: 'hero',
  title: 'Header Banner',
  description: 'The banner photo and school name at the top of every page.',
  group: 'Pages',
  home: true,
  permissions: [{ key: 'hero.manage', label: 'Edit the header banner' }],
  contentSchema: [
    { key: 'title', label: 'Text on the banner', type: 'text', max: 200, help: 'Leave empty to show the school name.' },
    { key: 'image', label: 'Banner photo', type: 'image', purpose: 'image', help: 'Best at 1022 x 220 pixels.' },
  ],
  defaultContent: {},
};

export const principal = {
  key: 'principal',
  title: "Head Teacher's Message",
  description: 'A message from the head teacher or principal.',
  group: 'Pages',
  home: true,
  nav: { label: "Head Teacher's Message", path: '/message', parent: 'about' },
  permissions: [{ key: 'principal.manage', label: "Edit the head teacher's message" }],
  contentSchema: [
    { key: 'heading', label: 'Section heading', type: 'text', max: 120 },
    { key: 'name', label: 'Name', type: 'text', max: 120 },
    { key: 'designation', label: 'Designation', type: 'text', max: 120 },
    { key: 'photo', label: 'Photo', type: 'image', purpose: 'image' },
    { key: 'excerpt', label: 'Short quote for the home page', type: 'textarea', max: 400 },
    { key: 'message', label: 'Full message', type: 'html' },
  ],
  defaultContent: { heading: 'Message from the Head Teacher', designation: 'Head Teacher' },
};

export const about = {
  key: 'about',
  title: 'About the School',
  description: 'History, mission and vision.',
  group: 'Pages',
  home: true,
  nav: { label: 'About', path: '/about' },
  permissions: [{ key: 'about.manage', label: 'Edit the about page' }],
  contentSchema: [
    { key: 'heading', label: 'Heading', type: 'text', max: 120 },
    { key: 'summary', label: 'Short summary for the home page', type: 'textarea', max: 500 },
    { key: 'image', label: 'Photo', type: 'image', purpose: 'image' },
    { key: 'body', label: 'Full story', type: 'html' },
    { key: 'mission', label: 'Mission', type: 'textarea', max: 800 },
    { key: 'vision', label: 'Vision', type: 'textarea', max: 800 },
  ],
  defaultContent: { heading: 'About the School' },
};

export const contact = {
  key: 'contact',
  title: 'Contact Page',
  description: 'Shows the address, phone, email and map from School Identity.',
  group: 'Pages',
  nav: { label: 'Contact', path: '/contact' },
  permissions: [],
  contentSchema: [
    { key: 'heading', label: 'Heading', type: 'text', max: 120 },
    { key: 'intro', label: 'Introduction', type: 'textarea', max: 400 },
  ],
  defaultContent: { heading: 'Contact Us', intro: '' },
};
