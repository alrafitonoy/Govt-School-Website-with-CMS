import test from 'node:test';
import assert from 'node:assert/strict';
import { fillLinks, portal } from '../src/modules/portal.js';

const copy = (v) => JSON.parse(JSON.stringify(v));
const defaults = () => copy(portal.defaultContent.sidebar_blocks);

test('boxes without a label keep their own links', () => {
  const saved = [{ title: 'ভর্তি ও ফর্ম ফিলাপ', links: [{ label: 'ভর্তি ফর্ম', link: '' }] }, { title: 'ক্লাব', links: [] }];
  const out = fillLinks(saved, defaults());
  assert.deepEqual(out[0].links.map((l) => l.label), ['ভর্তি ফর্ম', 'আবেদনের অবস্থা', 'অন্যান্য তথ্য']);
  assert.ok(out[1].links.every((l) => l.label.includes('ক্লাব')));
});

test('running on untouched defaults changes nothing', () => {
  assert.deepEqual(fillLinks(defaults(), defaults()), defaults());
});

test('removed boxes are not in the defaults', () => {
  const titles = defaults().map((b) => b.title);
  for (const gone of ['পোর্টাল', 'অভিধান', 'ওয়েব মেইল']) assert.ok(!titles.includes(gone), gone);
});

test('the menu has a single notices link instead of publications', () => {
  const labels = portal.defaultContent.menu.map((m) => m.label);
  assert.ok(!labels.includes('প্রকাশনা'));
  const notices = portal.defaultContent.menu.find((m) => m.label === 'নোটিশ');
  assert.equal(notices.link, '/notices');
  assert.equal(notices.links.length, 0);
});

test('a link the school set is kept, and an empty one is filled', () => {
  const saved = [{ label: 'A', link: '/mine', links: [] }, { label: 'B', link: '', links: [] }];
  const out = fillLinks(saved, [{ label: 'A', link: '/default' }, { label: 'B', link: '/default' }]);
  assert.equal(out[0].link, '/mine');
  assert.equal(out[1].link, '/default');
});

test('a box the school added is kept, and a new default is added', () => {
  const saved = [{ title: 'আমাদের নিজস্ব', links: [] }];
  const out = fillLinks(saved, [{ title: 'নতুন', links: [] }]);
  assert.deepEqual(out.map((b) => b.title), ['আমাদের নিজস্ব', 'নতুন']);
});
