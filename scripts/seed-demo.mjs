// Fills an empty install with clearly fictional sample content, for trying the site out.
// Refuses to run in production and refuses to overwrite a site that already has content.
import { pool, q, one } from '../server/src/core/db.js';
import { cfg } from '../server/src/config.js';
import { migrate } from '../server/src/core/migrate.js';
import { setupModules } from '../server/src/modules/index.js';

if (cfg.isProd) {
  console.error('The demo seed does not run in production.');
  process.exit(1);
}

await migrate();
if ((await one('SELECT COUNT(*) AS c FROM notices')).c > 0) {
  console.log('This site already has notices, so demo data was not added.');
  await pool.end();
  process.exit(0);
}

await setupModules();
const setContent = (key, value) => q('UPDATE modules SET content = ? WHERE mkey = ?', [JSON.stringify(value), key]);

await setContent('site', {
  school_name: 'Demo Model High School', school_name_bn: 'ডেমো মডেল হাই স্কুল', short_name: 'DMHS',
  tagline: 'Knowledge. Character. Future.', established: '1965', eiin: '000000', board: 'Rajshahi Education Board',
  address: 'School Road, Demo Upazila, Rajshahi', phone: '+880 1700-000000', email: 'info@example.edu.bd',
  office_hours: 'Sat to Thu, 9:00 am to 4:00 pm', socials: [{ label: 'Facebook', url: 'https://www.facebook.com/' }],
  footer_text: 'Sample content. Replace it from the admin panel.',
});
await setContent('principal', {
  heading: 'Message from the Head Teacher', name: 'Sample Head Teacher', designation: 'Head Teacher',
  excerpt: 'Education is more than marks. Our aim is to raise honest, capable young people who care for their community.',
  message: '<p>Welcome to our school. This is sample text for the head teacher\'s message, which you can replace from the admin panel.</p><p>We work closely with guardians so every student can reach their potential, in the classroom and beyond.</p>',
});
await setContent('about', {
  heading: 'About the School',
  summary: 'Founded in 1965, the school has served generations of learners from Class 1 to Class 10 under the national curriculum.',
  body: '<p>This is sample text for the school\'s story. Replace it with your own history, values and traditions.</p><h3>Our campus</h3><p>A green campus with labs, a library and a large playground.</p>',
  mission: 'To give every child a strong academic foundation and sound moral values.',
  vision: 'A generation of skilled, responsible citizens ready for a changing world.',
});

const today = new Date();
const dayOffset = (n) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);
const notices = [
  ['Annual examination routine published', 'Exams', 1, 1, '<p>The routine for the annual examination is now available. Students should collect admit cards from the class teacher.</p>'],
  ['Admission for the new session is open', 'Admission', 0, 2, '<p>Applications are open for Class 1 to Class 9. Please apply online or visit the school office.</p>'],
  ['Science fair next month', 'Events', 0, 5, '<p>Students of Class 6 to Class 10 may register project ideas with their science teachers.</p>'],
  ['Parents and teachers meeting', 'Meetings', 0, 8, '<p>All guardians are invited to the meeting in the school auditorium.</p>'],
  ['Winter vacation schedule', 'Holidays', 0, 12, '<p>The school will remain closed for winter vacation as per the academic calendar.</p>'],
];
for (const [title, category, pinned, days, body] of notices) {
  await q('INSERT INTO notices (title, category, pinned, notice_date, body, attachments) VALUES (?,?,?,?,?,?)', [title, category, pinned, dayOffset(days), body, '[]']);
}

for (const [title, year, category, description] of [
  ['Best School in the Upazila', '2025', 'Award', 'Recognised for academic results and co-curricular activities.'],
  ['Divisional Science Olympiad Champions', '2025', 'Science', 'Our Class 9 team won first place at the divisional round.'],
  ['District Football Runners-up', '2024', 'Sports', 'The school football team reached the final of the inter-school tournament.'],
]) {
  await q('INSERT INTO achievements (title, year, category, description) VALUES (?,?,?,?)', [title, year, category, description]);
}

await q("UPDATE facilities SET quantity = 32 WHERE name = 'Classrooms'");
await q("UPDATE facilities SET quantity = 2 WHERE name = 'Computer Lab'");
await q("UPDATE facilities SET quantity = 1 WHERE name IN ('Science Lab','Chemistry Lab','Library')");
await q("UPDATE facilities SET quantity = 0 WHERE name IN ('Physics Lab','Biology Lab')");
await q("UPDATE facilities SET published = 1 WHERE name = 'Playground'");

await q("INSERT INTO gallery_items (type, title, album, url, thumb) VALUES ('youtube','Sample video','Videos','https://www.youtube.com/watch?v=aqz-KE-bpKQ','https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg')");

// Class 10 students with marks, so result lookup can be tried straight away.
const year = today.getFullYear();
const scale = await one('SELECT id FROM grading_scales WHERE is_system = 1');
const exam = await q('INSERT INTO exams (name, session_year, scale_id, published, published_at) VALUES (?,?,?,1,UTC_TIMESTAMP())', ['Annual Examination', year, scale.id]);
const klass = await one('SELECT id FROM classes WHERE level = 10');
const subjects = await q('SELECT * FROM subjects WHERE class_id = ?', [klass.id]);
const higherMath = subjects.find((s) => s.name === 'Higher Mathematics');
const humanitiesOptional = subjects.find((s) => s.name === 'Agriculture Studies');

const students = [
  { roll: 1, name: 'Sample Student One', group: 'Science', dob: `${year - 15}-01-15`, optional: higherMath.id, base: 88 },
  { roll: 2, name: 'Sample Student Two', group: 'Science', dob: `${year - 15}-03-22`, optional: higherMath.id, base: 71 },
  { roll: 3, name: 'Sample Student Three', group: 'Humanities', dob: `${year - 15}-06-09`, optional: humanitiesOptional.id, base: 58 },
  { roll: 4, name: 'Sample Student Four', group: 'Business Studies', dob: `${year - 15}-09-30`, optional: humanitiesOptional.id, base: 44 },
];
for (const s of students) {
  const r = await q('INSERT INTO students (class_id, session_year, roll, name, reg_no, dob, group_name, optional_subject_id, father_name, mother_name) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [klass.id, year, s.roll, s.name, `10000${s.roll}`, s.dob, s.group, s.optional, 'Sample Father', 'Sample Mother']);
  for (const [i, subject] of subjects.entries()) {
    if (subject.group_name && subject.group_name !== s.group) continue;
    if (subject.is_optional && subject.id !== s.optional) continue;
    await q('INSERT INTO marks (exam_id, student_id, subject_id, marks) VALUES (?,?,?,?)', [exam.insertId, r.insertId, subject.id, Math.min(100, s.base + ((i * 7) % 11) - 4)]);
  }
}

console.log(`Demo data added. Try a result: Annual Examination, Class 10, roll 1, date of birth ${students[0].dob}.`);
await pool.end();
