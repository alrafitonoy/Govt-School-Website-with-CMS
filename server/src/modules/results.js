import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { q, one, tx, parseJson } from '../core/db.js';
import { can } from '../core/auth.js';
import { audit, bad, HttpError, notFound } from '../core/util.js';
import { getConfig, getContent, moduleOn } from '../core/moduleStore.js';
import { computeResult, rankResults, subjectsForStudent, validateBands } from '../lib/grading.js';
import { GROUPS } from '../seed/curriculum.js';

const parseScale = (row) => ({ ...row, bands: parseJson(row.bands, []), rules: parseJson(row.rules, {}) });
const int = (v) => (Number.isInteger(Number(v)) ? Number(v) : null);
const text = (v, max = 150) => String(v ?? '').trim().slice(0, max);

async function classSubjects(classId) {
  return q('SELECT * FROM subjects WHERE class_id = ? AND active = 1 ORDER BY sort_order, id', [classId]);
}

async function marksMap(examId, studentIds) {
  if (!studentIds.length) return {};
  const rows = await q('SELECT student_id, subject_id, marks, absent FROM marks WHERE exam_id = ? AND student_id IN (?)', [examId, studentIds]);
  const out = {};
  for (const m of rows) (out[m.student_id] ||= {})[m.subject_id] = { marks: m.marks, absent: Boolean(m.absent) };
  return out;
}

// Computes and ranks every student of a class for an exam.
async function classResults(exam, classId) {
  const scale = parseScale(await one('SELECT * FROM grading_scales WHERE id = ?', [exam.scale_id]));
  const subjects = await classSubjects(classId);
  const students = await q('SELECT * FROM students WHERE class_id = ? AND session_year = ? AND active = 1 ORDER BY roll', [classId, exam.session_year]);
  const marks = await marksMap(exam.id, students.map((s) => s.id));
  const rows = students.map((student) => ({
    student,
    result: computeResult({ subjects: subjectsForStudent(student, subjects), marksBySubject: marks[student.id] || {}, scale }),
  }));
  return { rows: rankResults(rows), scale };
}

const lookupLimiter = rateLimit({
  windowMs: 5 * 60_000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many lookups. Please wait a few minutes and try again.' },
});

export const results = {
  key: 'results',
  title: 'Result Publication',
  description: 'Classes, subjects, students, marks, grading and class-wise result lookup.',
  group: 'Academics',
  nav: { label: 'Results', path: '/results' },
  adminPath: '/results',
  permissions: [
    { key: 'results.setup', label: 'Set up classes, subjects, grading and exams' },
    { key: 'results.students', label: 'Manage students' },
    { key: 'results.marks', label: 'Enter marks' },
    { key: 'results.publish', label: 'Publish results' },
  ],
  schema: [
    { key: 'verify_by', label: 'Details needed to view a result', type: 'select', default: 'dob', options: [
      { value: 'dob', label: 'Roll and date of birth (recommended)' },
      { value: 'reg_no', label: 'Roll and registration number' },
      { value: 'none', label: 'Roll only (anyone can view any result)' },
    ] },
    { key: 'show_position', label: 'Show class position on the marksheet', type: 'switch', default: true },
    { key: 'show_paper_marks', label: 'Show marks of each paper', type: 'switch', default: true },
  ],
  publicConfig: ['verify_by'],

  mount({ pub, admin }) {
    pub.get('/results/options', moduleOn('results'), async (req, res) => {
      const exams = await q('SELECT id, name, session_year FROM exams WHERE published = 1 ORDER BY session_year DESC, published_at DESC');
      const classes = await q('SELECT id, name, level FROM classes WHERE active = 1 ORDER BY level');
      res.json({ exams, classes });
    });

    pub.post('/results/lookup', moduleOn('results'), lookupLimiter, async (req, res) => {
      const c = await getConfig('results');
      const examId = int(req.body?.exam_id);
      const classId = int(req.body?.class_id);
      const roll = int(req.body?.roll);
      if (!examId || !classId || !roll) throw bad('Please choose the exam and class and enter the roll number.');

      // The same message covers a wrong roll and a wrong birth date, so student records cannot be probed.
      const miss = () => notFound('No result matches those details. Please check them and try again.');
      const exam = await one('SELECT * FROM exams WHERE id = ? AND published = 1', [examId]);
      if (!exam) throw miss();
      const student = await one('SELECT * FROM students WHERE class_id = ? AND session_year = ? AND roll = ? AND active = 1', [classId, exam.session_year, roll]);
      if (!student) throw miss();
      if (c.verify_by === 'dob' && (!student.dob || student.dob !== text(req.body?.dob, 10))) throw miss();
      if (c.verify_by === 'reg_no' && (!student.reg_no || student.reg_no !== text(req.body?.reg_no, 40))) throw miss();

      const { rows, scale } = await classResults(exam, classId);
      const row = rows.find((r) => r.student.id === student.id);
      if (!row || row.result.status === 'incomplete') throw miss();
      const klass = await one('SELECT name FROM classes WHERE id = ?', [classId]);
      const site = await getContent('site');
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        school: { name: site.school_name, logo: site.logo, address: site.address, eiin: site.eiin },
        exam: { name: exam.name, session_year: exam.session_year },
        class_name: klass.name,
        student: {
          name: student.name, roll: student.roll, reg_no: student.reg_no, group_name: student.group_name,
          father_name: student.father_name, mother_name: student.mother_name,
        },
        result: {
          ...row.result,
          lines: row.result.lines.map(({ missing, ...l }) => (c.show_paper_marks ? l : { ...l, papers: [] })),
        },
        position: c.show_position ? row.position : null,
        class_size: c.show_position ? rows.length : null,
        grading: scale.bands,
      });
    });

    const r = Router();
    r.use(moduleOn('results'));

    r.get('/meta', can('results.setup', 'results.students', 'results.marks', 'results.publish'), async (req, res) => {
      res.json({
        classes: await q('SELECT * FROM classes ORDER BY level'),
        subjects: await q('SELECT * FROM subjects ORDER BY class_id, sort_order, id'),
        exams: await q('SELECT e.*, g.name AS scale_name FROM exams e JOIN grading_scales g ON g.id = e.scale_id ORDER BY e.session_year DESC, e.id DESC'),
        scales: (await q('SELECT * FROM grading_scales ORDER BY is_system DESC, id')).map(parseScale),
        groups: GROUPS,
      });
    });

    // Classes and subjects
    r.post('/classes', can('results.setup'), async (req, res) => {
      const name = text(req.body?.name, 60);
      const level = int(req.body?.level);
      if (!name || level === null) throw bad('Class name and order number are required.');
      if (await one('SELECT id FROM classes WHERE level = ?', [level])) throw bad('Another class already has that order number.');
      const x = await q('INSERT INTO classes (name, level) VALUES (?,?)', [name, level]);
      await audit(req, 'class.create', name);
      res.status(201).json({ id: x.insertId });
    });

    r.put('/classes/:id', can('results.setup'), async (req, res) => {
      const name = text(req.body?.name, 60);
      const level = int(req.body?.level);
      if (!name || level === null) throw bad('Class name and order number are required.');
      if (await one('SELECT id FROM classes WHERE level = ? AND id <> ?', [level, Number(req.params.id)])) throw bad('Another class already has that order number.');
      await q('UPDATE classes SET name = ?, level = ?, active = ? WHERE id = ?', [name, level, req.body?.active ? 1 : 0, Number(req.params.id)]);
      res.json({ ok: true });
    });

    r.delete('/classes/:id', can('results.setup'), async (req, res) => {
      const id = Number(req.params.id);
      if (await one('SELECT id FROM students WHERE class_id = ? LIMIT 1', [id])) throw bad('This class has students. Move or delete them first, or mark the class inactive.');
      await q('DELETE FROM classes WHERE id = ?', [id]);
      await audit(req, 'class.delete', id);
      res.json({ ok: true });
    });

    const subjectValues = (b) => {
      const name = text(b?.name, 120);
      const full = Number(b?.full_marks);
      if (!name) throw bad('Subject name is required.');
      if (!(full > 0 && full <= 1000)) throw bad('Full marks must be between 1 and 1000.');
      const group = text(b?.group_name, 40) || null;
      return [name, text(b?.code, 20) || null, group, text(b?.paper_group, 120) || null, full, b?.is_optional ? 1 : 0, int(b?.sort_order) || 0, b?.active === false ? 0 : 1];
    };

    r.post('/subjects', can('results.setup'), async (req, res) => {
      const classId = int(req.body?.class_id);
      if (!classId || !(await one('SELECT id FROM classes WHERE id = ?', [classId]))) throw bad('Choose a class.');
      const x = await q('INSERT INTO subjects (name, code, group_name, paper_group, full_marks, is_optional, sort_order, active, class_id) VALUES (?,?,?,?,?,?,?,?,?)', [...subjectValues(req.body), classId]);
      await audit(req, 'subject.create', req.body.name);
      res.status(201).json({ id: x.insertId });
    });

    r.put('/subjects/:id', can('results.setup'), async (req, res) => {
      await q('UPDATE subjects SET name=?, code=?, group_name=?, paper_group=?, full_marks=?, is_optional=?, sort_order=?, active=? WHERE id=?', [...subjectValues(req.body), Number(req.params.id)]);
      await audit(req, 'subject.update', req.body.name);
      res.json({ ok: true });
    });

    r.delete('/subjects/:id', can('results.setup'), async (req, res) => {
      const id = Number(req.params.id);
      if (await one('SELECT subject_id FROM marks WHERE subject_id = ? LIMIT 1', [id])) throw bad('This subject already has marks. Mark it inactive instead of deleting it.');
      await q('DELETE FROM subjects WHERE id = ?', [id]);
      await audit(req, 'subject.delete', id);
      res.json({ ok: true });
    });

    // Students
    const studentValues = async (b) => {
      const name = text(b?.name);
      const roll = int(b?.roll);
      const classId = int(b?.class_id);
      const year = int(b?.session_year);
      if (!name) throw bad('Student name is required.');
      if (!roll || roll < 1) throw bad('Roll must be a positive number.');
      if (!classId) throw bad('Choose a class.');
      if (!year || year < 2000 || year > 2100) throw bad('Enter a valid session year.');
      const dob = text(b?.dob, 10);
      if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw bad('Date of birth must look like 2012-05-31.');
      const optionalId = int(b?.optional_subject_id) || null;
      if (optionalId && !(await one('SELECT id FROM subjects WHERE id = ? AND class_id = ? AND is_optional = 1', [optionalId, classId]))) throw bad('That fourth subject does not belong to this class.');
      return [classId, year, roll, name, text(b?.reg_no, 40) || null, dob || null, text(b?.gender, 20) || null, text(b?.group_name, 40) || null, optionalId, text(b?.father_name) || null, text(b?.mother_name) || null, b?.active === false ? 0 : 1];
    };

    r.get('/students', can('results.students', 'results.marks'), async (req, res) => {
      const classId = int(req.query.class_id);
      const year = int(req.query.session_year);
      if (!classId || !year) throw bad('Choose a class and session.');
      res.json({ items: await q('SELECT * FROM students WHERE class_id = ? AND session_year = ? ORDER BY roll', [classId, year]) });
    });

    const dupe = (err) => {
      if (err.code === 'ER_DUP_ENTRY') throw bad('Another student in this class and session already has that roll number.');
      throw err;
    };

    r.post('/students', can('results.students'), async (req, res) => {
      const values = await studentValues(req.body);
      const x = await q('INSERT INTO students (class_id, session_year, roll, name, reg_no, dob, gender, group_name, optional_subject_id, father_name, mother_name, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', values).catch(dupe);
      await audit(req, 'student.create', values[3]);
      res.status(201).json({ id: x.insertId });
    });

    r.put('/students/:id', can('results.students'), async (req, res) => {
      const values = await studentValues(req.body);
      await q('UPDATE students SET class_id=?, session_year=?, roll=?, name=?, reg_no=?, dob=?, gender=?, group_name=?, optional_subject_id=?, father_name=?, mother_name=?, active=? WHERE id=?', [...values, Number(req.params.id)]).catch(dupe);
      await audit(req, 'student.update', values[3]);
      res.json({ ok: true });
    });

    r.delete('/students/:id', can('results.students'), async (req, res) => {
      await q('DELETE FROM students WHERE id = ?', [Number(req.params.id)]);
      await audit(req, 'student.delete', req.params.id);
      res.json({ ok: true });
    });

    // Bulk import from rows the browser parsed from CSV. All-or-nothing, so a bad row is easy to fix and retry.
    r.post('/students/import', can('results.students'), async (req, res) => {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 2000) : [];
      const classId = int(req.body?.class_id);
      const year = int(req.body?.session_year);
      if (!rows.length) throw bad('There are no rows to import.');
      const prepared = [];
      for (let i = 0; i < rows.length; i++) {
        try {
          prepared.push(await studentValues({ ...rows[i], class_id: classId, session_year: year }));
        } catch (err) {
          throw bad(`Row ${i + 1}: ${err.message}`);
        }
      }
      await tx(async (t) => {
        for (const v of prepared) {
          await t.q(
            `INSERT INTO students (class_id, session_year, roll, name, reg_no, dob, gender, group_name, optional_subject_id, father_name, mother_name, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE name=VALUES(name), reg_no=VALUES(reg_no), dob=VALUES(dob), gender=VALUES(gender), group_name=VALUES(group_name), father_name=VALUES(father_name), mother_name=VALUES(mother_name)`,
            v,
          );
        }
      });
      await audit(req, 'student.import', `${prepared.length} rows`);
      res.json({ imported: prepared.length });
    });

    // Grading scales. The board's standard scale is read-only; schools copy it to make their own.
    const scaleValues = (b) => {
      const name = text(b?.name, 120);
      if (!name) throw bad('Give the grading scale a name.');
      const bands = (Array.isArray(b?.bands) ? b.bands : []).map((x) => ({ letter: text(x.letter, 5), min: Number(x.min), point: Number(x.point) }));
      const problem = validateBands(bands);
      if (problem) throw bad(problem);
      const rules = {
        fail_on_any_f: Boolean(b?.rules?.fail_on_any_f),
        optional_bonus: Boolean(b?.rules?.optional_bonus),
        optional_bonus_above: Number(b?.rules?.optional_bonus_above ?? 2) || 0,
      };
      return [name, JSON.stringify(bands), JSON.stringify(rules)];
    };

    r.post('/scales', can('results.setup'), async (req, res) => {
      const x = await q('INSERT INTO grading_scales (name, bands, rules) VALUES (?,?,?)', scaleValues(req.body));
      await audit(req, 'scale.create', req.body.name);
      res.status(201).json({ id: x.insertId });
    });

    r.put('/scales/:id', can('results.setup'), async (req, res) => {
      const row = await one('SELECT is_system FROM grading_scales WHERE id = ?', [Number(req.params.id)]);
      if (!row) throw notFound();
      if (row.is_system) throw bad('The standard board scale cannot be changed. Make a copy and edit that.');
      await q('UPDATE grading_scales SET name=?, bands=?, rules=? WHERE id=?', [...scaleValues(req.body), Number(req.params.id)]);
      await audit(req, 'scale.update', req.body.name);
      res.json({ ok: true });
    });

    r.post('/scales/:id/default', can('results.setup'), async (req, res) => {
      await tx(async (t) => {
        await t.q('UPDATE grading_scales SET is_default = 0');
        await t.q('UPDATE grading_scales SET is_default = 1 WHERE id = ?', [Number(req.params.id)]);
      });
      res.json({ ok: true });
    });

    r.delete('/scales/:id', can('results.setup'), async (req, res) => {
      const id = Number(req.params.id);
      const row = await one('SELECT is_system, is_default FROM grading_scales WHERE id = ?', [id]);
      if (!row) throw notFound();
      if (row.is_system) throw bad('The standard board scale cannot be deleted.');
      if (row.is_default) throw bad('Choose another default scale first.');
      if (await one('SELECT id FROM exams WHERE scale_id = ? LIMIT 1', [id])) throw bad('An exam uses this scale.');
      await q('DELETE FROM grading_scales WHERE id = ?', [id]);
      res.json({ ok: true });
    });

    // Exams
    const examValues = async (b) => {
      const name = text(b?.name, 120);
      const year = int(b?.session_year);
      if (!name) throw bad('Exam name is required.');
      if (!year || year < 2000 || year > 2100) throw bad('Enter a valid session year.');
      const scaleId = int(b?.scale_id) || (await one('SELECT id FROM grading_scales WHERE is_default = 1'))?.id;
      if (!scaleId || !(await one('SELECT id FROM grading_scales WHERE id = ?', [scaleId]))) throw bad('Choose a grading scale.');
      return [name, year, scaleId];
    };
    const examDupe = (err) => {
      if (err.code === 'ER_DUP_ENTRY') throw bad('An exam with this name already exists for that session.');
      throw err;
    };

    r.post('/exams', can('results.setup'), async (req, res) => {
      const x = await q('INSERT INTO exams (name, session_year, scale_id) VALUES (?,?,?)', await examValues(req.body)).catch(examDupe);
      await audit(req, 'exam.create', req.body.name);
      res.status(201).json({ id: x.insertId });
    });

    r.put('/exams/:id', can('results.setup'), async (req, res) => {
      await q('UPDATE exams SET name=?, session_year=?, scale_id=? WHERE id=?', [...(await examValues(req.body)), Number(req.params.id)]).catch(examDupe);
      res.json({ ok: true });
    });

    r.delete('/exams/:id', can('results.setup'), async (req, res) => {
      await q('DELETE FROM exams WHERE id = ?', [Number(req.params.id)]);
      await audit(req, 'exam.delete', req.params.id);
      res.json({ ok: true });
    });

    r.post('/exams/:id/publish', can('results.publish'), async (req, res) => {
      const published = req.body?.published ? 1 : 0;
      await q('UPDATE exams SET published = ?, published_at = IF(?, UTC_TIMESTAMP(), published_at) WHERE id = ?', [published, published, Number(req.params.id)]);
      await audit(req, published ? 'exam.publish' : 'exam.unpublish', req.params.id);
      res.json({ ok: true });
    });

    // Marks
    r.get('/marks', can('results.marks'), async (req, res) => {
      const exam = await one('SELECT * FROM exams WHERE id = ?', [int(req.query.exam_id)]);
      const subject = await one('SELECT * FROM subjects WHERE id = ?', [int(req.query.subject_id)]);
      if (!exam || !subject) throw bad('Choose an exam and subject.');
      const all = await q('SELECT * FROM students WHERE class_id = ? AND session_year = ? AND active = 1 ORDER BY roll', [subject.class_id, exam.session_year]);
      const students = all.filter((s) => subjectsForStudent(s, [subject]).length > 0);
      const marks = await marksMap(exam.id, students.map((s) => s.id));
      res.json({
        subject,
        items: students.map((s) => {
          const m = marks[s.id]?.[subject.id];
          return { id: s.id, roll: s.roll, name: s.name, marks: m?.marks == null ? null : Number(m.marks), absent: m?.absent ?? false };
        }),
      });
    });

    r.put('/marks', can('results.marks'), async (req, res) => {
      const exam = await one('SELECT * FROM exams WHERE id = ?', [int(req.body?.exam_id)]);
      const subject = await one('SELECT * FROM subjects WHERE id = ?', [int(req.body?.subject_id)]);
      if (!exam || !subject) throw bad('Choose an exam and subject.');
      const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
      const students = await q('SELECT id, roll FROM students WHERE class_id = ? AND session_year = ?', [subject.class_id, exam.session_year]);
      const rollOf = new Map(students.map((s) => [s.id, s.roll]));
      const full = Number(subject.full_marks);
      await tx(async (t) => {
        for (const e of entries) {
          const studentId = int(e.student_id);
          if (!rollOf.has(studentId)) throw bad('A student in the list is not in this class.');
          const blank = e.marks === null || e.marks === undefined || e.marks === '';
          if (!e.absent && blank) {
            await t.q('DELETE FROM marks WHERE exam_id=? AND student_id=? AND subject_id=?', [exam.id, studentId, subject.id]);
            continue;
          }
          const value = e.absent ? null : Number(e.marks);
          if (!e.absent && !(value >= 0 && value <= full)) throw bad(`Roll ${rollOf.get(studentId)}: marks must be between 0 and ${full}.`);
          await t.q(
            'INSERT INTO marks (exam_id, student_id, subject_id, marks, absent, updated_by) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE marks=VALUES(marks), absent=VALUES(absent), updated_by=VALUES(updated_by)',
            [exam.id, studentId, subject.id, value, e.absent ? 1 : 0, req.user.id],
          );
        }
      });
      await audit(req, 'marks.save', `exam ${exam.id}, subject ${subject.id}, ${entries.length} students`);
      res.json({ ok: true });
    });

    // Whole-class sheet: every student's computed result, for checking before publishing.
    r.get('/tabulation', can('results.marks', 'results.publish'), async (req, res) => {
      const exam = await one('SELECT * FROM exams WHERE id = ?', [int(req.query.exam_id)]);
      const classId = int(req.query.class_id);
      if (!exam || !classId) throw bad('Choose an exam and class.');
      const { rows, scale } = await classResults(exam, classId);
      res.json({
        exam,
        scale,
        rows: rows.map((x) => ({ id: x.student.id, roll: x.student.roll, name: x.student.name, group_name: x.student.group_name, position: x.position ?? null, result: x.result })),
      });
    });

    admin.use('/results', r);
  },
};
