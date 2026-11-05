import { q, one } from './db.js';
import { BD_STANDARD_BANDS, BD_STANDARD_RULES } from '../lib/grading.js';
import { CLASS_SUBJECTS } from '../seed/curriculum.js';
import { EMAIL_TEMPLATES } from '../seed/emailTemplates.js';

const TABLE = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

// JSON is stored in TEXT columns on purpose: MariaDB (used by most shared hosts)
// and MySQL treat the JSON type differently.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (k VARCHAR(100) PRIMARY KEY, v MEDIUMTEXT) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS modules (
    mkey VARCHAR(50) PRIMARY KEY, enabled TINYINT(1) NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0,
    config MEDIUMTEXT, content MEDIUMTEXT) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL, role ENUM('admin','staff') NOT NULL DEFAULT 'staff', permissions TEXT,
    email_verified_at DATETIME NULL, active TINYINT(1) NOT NULL DEFAULT 1, last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id_hash CHAR(64) PRIMARY KEY, user_id INT NOT NULL, expires_at DATETIME NOT NULL, ip VARCHAR(64), user_agent VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX (user_id), INDEX (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS user_tokens (
    token_hash CHAR(64) PRIMARY KEY, user_id INT NOT NULL, kind ENUM('activate','reset') NOT NULL,
    expires_at DATETIME NOT NULL, used_at DATETIME NULL, INDEX (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    bucket CHAR(64) PRIMARY KEY, attempts INT NOT NULL DEFAULT 0, first_at DATETIME NOT NULL, locked_until DATETIME NULL) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id INT NULL, action VARCHAR(80) NOT NULL, detail VARCHAR(500), ip VARCHAR(64),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX (created_at)) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS media (
    id INT AUTO_INCREMENT PRIMARY KEY, kind ENUM('image','pdf','video','icon') NOT NULL, url VARCHAR(255) NOT NULL, thumb_url VARCHAR(255),
    original_name VARCHAR(255), mime VARCHAR(80), size INT, original_size INT, width INT, height INT, alt VARCHAR(255),
    uploaded_by INT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX (kind)) ${TABLE}`,
  "ALTER TABLE media MODIFY kind ENUM('image','pdf','video','icon','audio') NOT NULL",
  `CREATE TABLE IF NOT EXISTS notices (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, category VARCHAR(80), body MEDIUMTEXT, attachments TEXT,
    pinned TINYINT(1) NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 1, notice_date DATE NOT NULL, expires_on DATE NULL,
    created_by INT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (published, notice_date)) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS achievements (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, year VARCHAR(20), category VARCHAR(80), description TEXT, image VARCHAR(255),
    sort_order INT NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS gallery_items (
    id INT AUTO_INCREMENT PRIMARY KEY, type ENUM('image','youtube','video') NOT NULL DEFAULT 'image', title VARCHAR(255), album VARCHAR(80),
    url VARCHAR(500) NOT NULL, thumb VARCHAR(255), sort_order INT NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS facilities (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, kind ENUM('count','feature') NOT NULL DEFAULT 'count', category VARCHAR(60),
    quantity INT NOT NULL DEFAULT 0, description TEXT, icon VARCHAR(40), image VARCHAR(255), sort_order INT NOT NULL DEFAULT 0,
    published TINYINT(1) NOT NULL DEFAULT 1) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS pages (
    id INT AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(120) NOT NULL UNIQUE, title VARCHAR(255) NOT NULL, body MEDIUMTEXT, seo_description VARCHAR(300),
    in_nav TINYINT(1) NOT NULL DEFAULT 0, sort_order INT NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(60) NOT NULL, level INT NOT NULL UNIQUE, active TINYINT(1) NOT NULL DEFAULT 1) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY, class_id INT NOT NULL, name VARCHAR(120) NOT NULL, code VARCHAR(20), group_name VARCHAR(40) NULL,
    paper_group VARCHAR(120) NULL, full_marks DECIMAL(6,2) NOT NULL DEFAULT 100, is_optional TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1, INDEX (class_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY, class_id INT NOT NULL, session_year INT NOT NULL, roll INT NOT NULL, name VARCHAR(150) NOT NULL,
    reg_no VARCHAR(40), dob DATE NULL, gender VARCHAR(20), group_name VARCHAR(40) NULL, optional_subject_id INT NULL,
    father_name VARCHAR(150), mother_name VARCHAR(150), active TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uniq_roll (class_id, session_year, roll),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS grading_scales (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, is_system TINYINT(1) NOT NULL DEFAULT 0, is_default TINYINT(1) NOT NULL DEFAULT 0,
    bands TEXT NOT NULL, rules TEXT NOT NULL) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS exams (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, session_year INT NOT NULL, scale_id INT NOT NULL, published TINYINT(1) NOT NULL DEFAULT 0,
    published_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_exam (name, session_year),
    FOREIGN KEY (scale_id) REFERENCES grading_scales(id)) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS marks (
    exam_id INT NOT NULL, student_id INT NOT NULL, subject_id INT NOT NULL, marks DECIMAL(6,2) NULL, absent TINYINT(1) NOT NULL DEFAULT 0,
    updated_by INT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (exam_id, student_id, subject_id), INDEX (student_id),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY, app_no VARCHAR(30) NULL UNIQUE, class_id INT NULL, session_year INT, student_name VARCHAR(150), mobile VARCHAR(20),
    email VARCHAR(190), data MEDIUMTEXT, files TEXT, status ENUM('submitted','reviewing','accepted','waitlisted','rejected') NOT NULL DEFAULT 'submitted',
    fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0, payment_status ENUM('not_required','unpaid','pending','paid') NOT NULL DEFAULT 'unpaid', notes TEXT, ip VARCHAR(64),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (status), INDEX (created_at)) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY, ref VARCHAR(40) NOT NULL UNIQUE, application_id INT NOT NULL, method VARCHAR(30) NOT NULL, amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(5) NOT NULL DEFAULT 'BDT', status ENUM('pending','awaiting_verification','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
    payer_ref VARCHAR(120), gateway_data TEXT, verified_by INT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, paid_at DATETIME NULL,
    INDEX (application_id), FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150) NOT NULL, name_en VARCHAR(150), faculty VARCHAR(120), description TEXT, image VARCHAR(255),
    sort_order INT NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 1) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS people (
    id INT AUTO_INCREMENT PRIMARY KEY, type ENUM('officer','teacher','staff','information') NOT NULL DEFAULT 'teacher', name VARCHAR(150) NOT NULL, name_en VARCHAR(150),
    designation VARCHAR(150), employee_id VARCHAR(40), batch VARCHAR(40), department_id INT NULL, photo VARCHAR(255), phone_office VARCHAR(40), intercom VARCHAR(20),
    phone_home VARCHAR(40), fax VARCHAR(40), email VARCHAR(190), mobile VARCHAR(40), room VARCHAR(40), cv VARCHAR(255), bio MEDIUMTEXT,
    sort_order INT NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 1, INDEX (type, published),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, starts_on DATE NOT NULL, ends_on DATE NULL, time_text VARCHAR(60), location VARCHAR(190), description MEDIUMTEXT,
    published TINYINT(1) NOT NULL DEFAULT 1, INDEX (published, starts_on)) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS news (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, news_date DATE NOT NULL, body MEDIUMTEXT, image VARCHAR(255), external_link VARCHAR(500), expires_on DATE NULL,
    published TINYINT(1) NOT NULL DEFAULT 1, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX (published, news_date)) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS publications (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, category VARCHAR(80), pub_date DATE NULL, description TEXT, file VARCHAR(500),
    sort_order INT NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 1, INDEX (published, category)) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS activities (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, category VARCHAR(80), advisor VARCHAR(150), schedule VARCHAR(150), description MEDIUMTEXT, image VARCHAR(255),
    sort_order INT NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 1) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150) NOT NULL, email VARCHAR(190), mobile VARCHAR(30), subject VARCHAR(200), message TEXT NOT NULL, page VARCHAR(200),
    status ENUM('new','read','closed') NOT NULL DEFAULT 'new', notes TEXT, ip VARCHAR(64), created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX (status, created_at)) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS history_albums (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200) NOT NULL, title_en VARCHAR(200), event_year VARCHAR(20), description TEXT, cover VARCHAR(255), photos MEDIUMTEXT,
    sort_order INT NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 1) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS alumni (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150) NOT NULL, name_en VARCHAR(150), designation VARCHAR(200) NOT NULL, designation_en VARCHAR(200), passing_year VARCHAR(40), about TEXT, photo VARCHAR(255),
    sort_order INT NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 1) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS email_templates (
    id INT AUTO_INCREMENT PRIMARY KEY, tkey VARCHAR(60) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL, subject VARCHAR(255) NOT NULL, body MEDIUMTEXT NOT NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ${TABLE}`,
  `CREATE TABLE IF NOT EXISTS email_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, to_addr VARCHAR(190), subject VARCHAR(255), template VARCHAR(60), status ENUM('sent','failed') NOT NULL, error VARCHAR(500),
    sent_by INT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX (created_at)) ${TABLE}`,
];

const DEFAULT_FACILITIES = [
  ['Classrooms', 'count', 'Classrooms', 'door-open'],
  ['Computer Lab', 'count', 'Labs', 'monitor'],
  ['Science Lab', 'count', 'Labs', 'flask'],
  ['Physics Lab', 'count', 'Labs', 'atom'],
  ['Chemistry Lab', 'count', 'Labs', 'test-tube'],
  ['Biology Lab', 'count', 'Labs', 'microscope'],
  ['Library', 'count', 'Learning', 'book'],
];

async function seedAcademics() {
  const existing = await one('SELECT COUNT(*) AS c FROM classes');
  if (existing.c > 0) return;
  for (const { level, subjects } of CLASS_SUBJECTS) {
    const r = await q('INSERT INTO classes (name, level) VALUES (?, ?)', [`Class ${level}`, level]);
    let sort = 0;
    for (const s of subjects) {
      await q(
        'INSERT INTO subjects (class_id, name, code, group_name, paper_group, full_marks, is_optional, sort_order) VALUES (?,?,?,?,?,?,?,?)',
        [r.insertId, s.name, s.code || null, s.group || null, s.paper || null, s.full || 100, s.optional ? 1 : 0, sort++],
      );
    }
  }
}

async function seedDefaults() {
  await seedAcademics();

  if (!(await one('SELECT id FROM grading_scales WHERE is_system = 1'))) {
    await q('INSERT INTO grading_scales (name, is_system, is_default, bands, rules) VALUES (?,1,1,?,?)', [
      'Bangladesh Education Board (Standard)',
      JSON.stringify(BD_STANDARD_BANDS),
      JSON.stringify(BD_STANDARD_RULES),
    ]);
  }

  // Counts start at zero and features start unpublished, so nothing shows until the school confirms it.
  if ((await one('SELECT COUNT(*) AS c FROM facilities')).c === 0) {
    let sort = 0;
    for (const [name, kind, category, icon] of DEFAULT_FACILITIES) {
      await q('INSERT INTO facilities (name, kind, category, quantity, icon, sort_order) VALUES (?,?,?,0,?,?)', [name, kind, category, icon, sort++]);
    }
    await q(
      "INSERT INTO facilities (name, kind, category, description, icon, sort_order, published) VALUES ('Playground','feature','Sports','Open field for games and assembly.','trophy',?,0)",
      [sort],
    );
  }

  for (const t of EMAIL_TEMPLATES) {
    await q('INSERT IGNORE INTO email_templates (tkey, name, subject, body, is_system) VALUES (?,?,?,?,1)', [t.key, t.name, t.subject, t.body]);
  }
}

export async function migrate() {
  for (const sql of SCHEMA) await q(sql);
  // ADD COLUMN IF NOT EXISTS is MariaDB only, so this works on MySQL too.
  const [{ c }] = await q("SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'people' AND column_name = 'education'");
  if (!c) await q('ALTER TABLE people ADD COLUMN education VARCHAR(255) NULL AFTER designation');
  await seedDefaults();
}
