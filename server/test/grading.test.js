import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BD_STANDARD_BANDS as bands,
  BD_STANDARD_RULES as rules,
  bandForPercent,
  computeResult,
  rankResults,
  subjectsForStudent,
  validateBands,
} from '../src/lib/grading.js';

const scale = { bands, rules };
const sub = (id, extra = {}) => ({ id, name: `S${id}`, full_marks: 100, ...extra });
const marks = (...values) => Object.fromEntries(values.map((v, i) => [i + 1, { marks: v, absent: false }]));

test('every band boundary of the board scale', () => {
  const cases = [[100, 'A+'], [80, 'A+'], [79.99, 'A'], [70, 'A'], [60, 'A-'], [50, 'B'], [40, 'C'], [33, 'D'], [32.99, 'F'], [0, 'F']];
  for (const [pct, letter] of cases) assert.equal(bandForPercent(bands, pct).letter, letter, `${pct}%`);
});

test('GPA is the average of grade points', () => {
  const r = computeResult({ subjects: [sub(1), sub(2)], marksBySubject: marks(85, 72), scale });
  assert.equal(r.status, 'passed');
  assert.equal(r.gpa, 4.5);
  assert.equal(r.letter, 'A');
  assert.equal(r.total, 157);
});

test('an F in a compulsory subject fails the whole result', () => {
  const r = computeResult({ subjects: [sub(1), sub(2), sub(3)], marksBySubject: marks(95, 95, 20), scale });
  assert.equal(r.status, 'failed');
  assert.equal(r.gpa, 0);
  assert.equal(r.letter, 'F');
  assert.equal(r.failedSubjects, 1);
});

test('fourth subject adds only the points above 2, and GPA caps at 5', () => {
  const subjects = [sub(1), sub(2), sub(3, { is_optional: 1 })];
  assert.equal(computeResult({ subjects, marksBySubject: marks(72, 72, 85), scale }).gpa, 5);
  assert.equal(computeResult({ subjects, marksBySubject: marks(65, 65, 85), scale }).gpa, 5);
  assert.equal(computeResult({ subjects, marksBySubject: marks(55, 55, 85), scale }).gpa, 4.5);
  assert.equal(computeResult({ subjects, marksBySubject: marks(55, 55, 45), scale }).gpa, 3);
});

test('an F in the fourth subject does not fail the student', () => {
  const subjects = [sub(1), sub(2), sub(3, { is_optional: 1 })];
  const r = computeResult({ subjects, marksBySubject: marks(55, 55, 10), scale });
  assert.equal(r.status, 'passed');
  assert.equal(r.gpa, 3);
});

test('1st and 2nd papers merge into one graded subject', () => {
  const subjects = [sub(1, { paper_group: 'Bangla' }), sub(2, { paper_group: 'Bangla' }), sub(3)];
  const r = computeResult({ subjects, marksBySubject: marks(90, 60, 80), scale });
  assert.equal(r.lines.length, 2);
  assert.equal(r.lines[0].name, 'Bangla');
  assert.equal(r.lines[0].obtained, 150);
  assert.equal(r.lines[0].full, 200);
  assert.equal(r.lines[0].letter, 'A');
  assert.equal(r.gpa, 4.5);
});

test('a strong paper can carry a weak one, but an absent paper fails the subject', () => {
  const subjects = [sub(1, { paper_group: 'English' }), sub(2, { paper_group: 'English' })];
  assert.equal(computeResult({ subjects, marksBySubject: marks(60, 20), scale }).status, 'passed');
  const absent = { 1: { marks: 90, absent: false }, 2: { marks: null, absent: true } };
  assert.equal(computeResult({ subjects, marksBySubject: absent, scale }).status, 'failed');
});

test('missing marks give an incomplete result, not a fail', () => {
  const r = computeResult({ subjects: [sub(1), sub(2)], marksBySubject: { 1: { marks: 80, absent: false } }, scale });
  assert.equal(r.status, 'incomplete');
  assert.equal(r.gpa, null);
});

test('zero marks count as entered', () => {
  const r = computeResult({ subjects: [sub(1)], marksBySubject: { 1: { marks: 0, absent: false } }, scale });
  assert.equal(r.status, 'failed');
});

test('group and fourth-subject filtering', () => {
  const subjects = [sub(1), sub(2, { group_name: 'Science' }), sub(3, { group_name: 'Humanities' }), sub(4, { is_optional: 1 }), sub(5, { is_optional: 1 })];
  const ids = subjectsForStudent({ group_name: 'Science', optional_subject_id: 5 }, subjects).map((s) => s.id);
  assert.deepEqual(ids, [1, 2, 5]);
});

test('a custom scale works and bad scales are rejected', () => {
  const custom = [{ letter: 'P', min: 50, point: 1 }, { letter: 'X', min: 0, point: 0 }];
  assert.equal(validateBands(custom), null);
  const r = computeResult({ subjects: [sub(1)], marksBySubject: marks(50), scale: { bands: custom, rules } });
  assert.equal(r.letter, 'P');
  assert.ok(validateBands([{ letter: 'A', min: 50, point: 1 }, { letter: 'B', min: 10, point: 0 }]));
  assert.ok(validateBands([{ letter: 'A', min: 50, point: 1 }, { letter: 'B', min: 0, point: 2 }]));
});

test('ranking shares positions on ties and skips incomplete results', () => {
  const row = (status, gpa, total) => ({ result: { status, gpa, total } });
  const rows = [row('passed', 4, 300), row('passed', 5, 400), row('passed', 4, 300), row('failed', 0, 500), row('incomplete', null, 0)];
  rankResults(rows);
  assert.deepEqual(rows.map((r) => r.position), [2, 1, 2, 4, undefined]);
});
