// Result calculation. Pure functions, so the rules can be unit tested without a database.
// Marks are stored and results are computed on read, so totals can never drift from the marks.

export const BD_STANDARD_BANDS = [
  { letter: 'A+', min: 80, point: 5 },
  { letter: 'A', min: 70, point: 4 },
  { letter: 'A-', min: 60, point: 3.5 },
  { letter: 'B', min: 50, point: 3 },
  { letter: 'C', min: 40, point: 2 },
  { letter: 'D', min: 33, point: 1 },
  { letter: 'F', min: 0, point: 0 },
];

export const BD_STANDARD_RULES = {
  fail_on_any_f: true, // an F in any compulsory subject fails the whole result
  optional_bonus: true, // the fourth subject only adds the points above the threshold
  optional_bonus_above: 2,
};

const byMinDesc = (bands) => [...bands].sort((a, b) => b.min - a.min);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function bandForPercent(bands, percent) {
  return byMinDesc(bands).find((b) => percent >= b.min) || byMinDesc(bands).at(-1);
}

export function letterForGpa(bands, gpa) {
  const byPoint = [...bands].sort((a, b) => b.point - a.point);
  return (byPoint.find((b) => gpa >= b.point) || byPoint.at(-1)).letter;
}

export function validateBands(bands) {
  if (!Array.isArray(bands) || bands.length < 2) return 'Add at least two grades.';
  for (const b of bands) {
    if (!String(b.letter || '').trim()) return 'Every grade needs a letter.';
    if (!(b.min >= 0 && b.min <= 100)) return 'Minimum marks must be between 0 and 100.';
    if (!(b.point >= 0)) return 'Grade points cannot be negative.';
  }
  if (new Set(bands.map((b) => Number(b.min))).size !== bands.length) return 'Two grades have the same minimum marks.';
  const sorted = byMinDesc(bands);
  if (Number(sorted.at(-1).min) !== 0) return 'The lowest grade must start at 0.';
  if (Number(sorted.at(-1).point) !== 0) return 'The lowest grade must have 0 points, because it is the fail grade.';
  for (let i = 1; i < sorted.length; i++) {
    if (Number(sorted[i].point) > Number(sorted[i - 1].point)) return 'Higher marks cannot earn fewer grade points.';
  }
  return null;
}

// Subjects a student actually sits: common ones, their group's, and only the fourth subject they chose.
export function subjectsForStudent(student, subjects) {
  return subjects.filter((s) => {
    if (s.group_name && s.group_name !== student.group_name) return false;
    if (s.is_optional) return Number(s.id) === Number(student.optional_subject_id);
    return true;
  });
}

function mergePapers(subjects, marksBySubject) {
  const lines = new Map();
  for (const s of subjects) {
    const key = s.paper_group ? `p:${s.paper_group}` : `s:${s.id}`;
    const line = lines.get(key) || {
      name: s.paper_group || s.name,
      code: s.paper_group ? null : s.code || null,
      papers: [],
      full: 0,
      obtained: 0,
      absent: false,
      missing: false,
      optional: false,
    };
    const m = marksBySubject[s.id];
    const entered = m && (m.absent || (m.marks !== null && m.marks !== undefined && m.marks !== ''));
    line.full += Number(s.full_marks);
    line.optional = line.optional || Boolean(s.is_optional);
    if (!entered) line.missing = true;
    else if (m.absent) line.absent = true;
    else line.obtained += Number(m.marks);
    line.papers.push({ name: s.name, full: Number(s.full_marks), marks: entered && !m.absent ? Number(m.marks) : null, absent: Boolean(entered && m.absent) });
    lines.set(key, line);
  }
  return [...lines.values()];
}

export function computeResult({ subjects, marksBySubject, scale }) {
  const { bands, rules } = scale;
  const lines = mergePapers(subjects, marksBySubject).map((line) => {
    const percent = line.full > 0 ? (line.obtained / line.full) * 100 : 0;
    const band = line.absent ? byMinDesc(bands).at(-1) : bandForPercent(bands, percent);
    return { ...line, obtained: round2(line.obtained), percent: round2(percent), letter: band.letter, point: Number(band.point) };
  });

  const total = round2(lines.reduce((sum, l) => sum + l.obtained, 0));
  const fullTotal = round2(lines.reduce((sum, l) => sum + l.full, 0));

  if (lines.length === 0 || lines.some((l) => l.missing)) {
    return { status: 'incomplete', lines, total, fullTotal, gpa: null, letter: null, failedSubjects: 0 };
  }

  const compulsory = lines.filter((l) => !l.optional);
  const optional = lines.filter((l) => l.optional);
  const failed = compulsory.filter((l) => l.point === 0);
  const maxPoint = Math.max(...bands.map((b) => Number(b.point)));

  if (rules.fail_on_any_f && failed.length > 0) {
    return { status: 'failed', lines, total, fullTotal, gpa: 0, letter: letterForGpa(bands, 0), failedSubjects: failed.length };
  }

  let points = compulsory.reduce((sum, l) => sum + l.point, 0);
  let divisor = compulsory.length;
  for (const l of optional) {
    if (rules.optional_bonus) {
      points += Math.max(0, l.point - Number(rules.optional_bonus_above ?? 2));
    } else {
      points += l.point;
      divisor += 1;
    }
  }
  const gpa = divisor > 0 ? round2(Math.min(points / divisor, maxPoint)) : 0;
  return {
    status: gpa > 0 ? 'passed' : 'failed',
    lines,
    total,
    fullTotal,
    gpa,
    letter: letterForGpa(bands, gpa),
    failedSubjects: failed.length,
  };
}

// Merit order: passed first, then GPA, then total marks. Equal results share a position.
export function rankResults(rows) {
  const rankable = rows.filter((r) => r.result.status !== 'incomplete');
  rankable.sort((a, b) => {
    const pa = a.result.status === 'passed' ? 1 : 0;
    const pb = b.result.status === 'passed' ? 1 : 0;
    return pb - pa || b.result.gpa - a.result.gpa || b.result.total - a.result.total;
  });
  rankable.forEach((row, i) => {
    const prev = rankable[i - 1];
    const tied = prev && prev.result.status === row.result.status && prev.result.gpa === row.result.gpa && prev.result.total === row.result.total;
    row.position = tied ? prev.position : i + 1;
  });
  return rows;
}
