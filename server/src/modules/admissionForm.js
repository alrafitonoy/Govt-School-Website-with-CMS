// The standard admission form. Admins can edit, add and remove fields, except `locked` ones the system relies on.
const f = (key, label, type = 'text', extra = {}) => ({ key, label, type, required: false, width: 'half', ...extra });
const req = { required: true };

export const DEFAULT_FORM = {
  intro: 'Write names and dates exactly as they appear on the birth registration certificate. Fields marked * are required.',
  declaration: 'I declare that the information given above is true. If any information is found to be false, the admission may be cancelled.',
  sections: [
    {
      id: 'admission', title: 'Admission Details',
      fields: [
        f('class_applying', 'Class applying for', 'class', { ...req, locked: true }),
        f('group', 'Group (Class 9 and 10)', 'select', { options: ['Science', 'Business Studies', 'Humanities'], showIf: { field: 'class_applying', levels: [9, 10] } }),
        f('shift', 'Shift', 'select', { options: ['Morning', 'Day'] }),
        f('version', 'Version', 'select', { options: ['Bangla', 'English'] }),
      ],
    },
    {
      id: 'student', title: "Student's Information",
      fields: [
        f('student_name_en', 'Full name (English)', 'text', { ...req, locked: true }),
        f('student_name_bn', 'Full name (Bangla)', 'text', req),
        f('dob', 'Date of birth', 'date', req),
        f('birth_reg_no', 'Birth registration number (17 digits)', 'text', { ...req, pattern: 'brn' }),
        f('gender', 'Gender', 'select', { ...req, options: ['Male', 'Female', 'Other'] }),
        f('religion', 'Religion', 'select', { ...req, options: ['Islam', 'Hinduism', 'Buddhism', 'Christianity', 'Other'] }),
        f('blood_group', 'Blood group', 'select', { options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known'] }),
        f('nationality', 'Nationality', 'text', { ...req, default: 'Bangladeshi' }),
        f('quota', 'Quota, if any', 'select', { options: ['None', 'Freedom Fighter', 'Disability', 'Sibling', 'Education Ministry staff', 'Catchment area'] }),
        f('photo', 'Passport size photo', 'file', { ...req, accept: 'image' }),
      ],
    },
    {
      id: 'parents', title: "Parents' Information",
      fields: [
        f('father_name', "Father's name", 'text', req),
        f('father_nid', "Father's NID number", 'text', { pattern: 'nid' }),
        f('father_occupation', "Father's occupation"),
        f('father_mobile', "Father's mobile", 'tel', { pattern: 'mobile' }),
        f('mother_name', "Mother's name", 'text', req),
        f('mother_nid', "Mother's NID number", 'text', { pattern: 'nid' }),
        f('mother_occupation', "Mother's occupation"),
        f('mother_mobile', "Mother's mobile", 'tel', { pattern: 'mobile' }),
      ],
    },
    {
      id: 'guardian', title: 'Guardian and Contact',
      fields: [
        f('guardian_name', "Guardian's name", 'text', req),
        f('guardian_relation', 'Relation with the student', 'text', req),
        f('guardian_mobile', 'Contact mobile', 'tel', { ...req, locked: true, pattern: 'mobile', help: 'Used with the application number to check the status.' }),
        f('guardian_email', 'Email', 'email', { locked: true, help: 'Optional. Confirmation will be sent here.' }),
        f('annual_income', 'Annual family income (BDT)', 'number'),
      ],
    },
    {
      id: 'address', title: 'Address',
      fields: [
        f('present_address', 'Present address (village/road, post office)', 'textarea', { ...req, width: 'full' }),
        f('present_district', 'Present district', 'text', req),
        f('present_upazila', 'Present upazila/thana', 'text', req),
        f('permanent_address', 'Permanent address (village/road, post office)', 'textarea', { ...req, width: 'full' }),
        f('permanent_district', 'Permanent district', 'text', req),
        f('permanent_upazila', 'Permanent upazila/thana', 'text', req),
      ],
    },
    {
      id: 'previous', title: 'Previous School',
      fields: [
        f('prev_school', 'Previous school name', 'text', { width: 'full' }),
        f('prev_class', 'Last class passed'),
        f('prev_year', 'Year passed', 'number'),
        f('prev_gpa', 'GPA / marks'),
        f('prev_roll', 'Roll number'),
        f('tc_no', 'Transfer certificate number'),
      ],
    },
    {
      id: 'documents', title: 'Documents',
      fields: [
        f('doc_birth_cert', 'Birth registration certificate', 'file', { ...req, accept: 'document' }),
        f('doc_marksheet', 'Last marksheet or transfer certificate', 'file', { accept: 'document' }),
        f('doc_parent_nid', "Parent's NID copy", 'file', { accept: 'document' }),
      ],
    },
  ],
};

export const FIELD_TYPES = ['text', 'textarea', 'email', 'tel', 'number', 'date', 'select', 'radio', 'checkbox', 'file', 'class'];

const PATTERNS = {
  brn: [/^\d{17}$/, 'must be exactly 17 digits'],
  nid: [/^(\d{10}|\d{13}|\d{17})$/, 'must be 10, 13 or 17 digits'],
  mobile: [/^01[3-9]\d{8}$/, 'must be an 11-digit Bangladeshi mobile number'],
};

export const allFields = (form) => form.sections.flatMap((s) => s.fields);

const LOCKED = allFields(DEFAULT_FORM).filter((x) => x.locked);

// Cleans a form definition from the builder. Locked fields are put back if they were removed.
export function cleanForm(input) {
  const seen = new Set();
  const sections = (Array.isArray(input?.sections) ? input.sections : []).slice(0, 30).map((s, i) => ({
    id: String(s.id || `section_${i}`).replace(/[^\w-]/g, '').slice(0, 40) || `section_${i}`,
    title: String(s.title || 'Section').slice(0, 120),
    fields: (Array.isArray(s.fields) ? s.fields : []).slice(0, 60).flatMap((x) => {
      const key = String(x.key || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 50);
      if (!key || seen.has(key)) return [];
      seen.add(key);
      const lockedDef = LOCKED.find((l) => l.key === key);
      const type = lockedDef ? lockedDef.type : FIELD_TYPES.includes(x.type) ? x.type : 'text';
      const field = {
        key,
        label: String(x.label || key).slice(0, 150),
        type,
        required: lockedDef ? lockedDef.required : Boolean(x.required),
        width: x.width === 'full' ? 'full' : 'half',
      };
      if (lockedDef) field.locked = true;
      if (x.help) field.help = String(x.help).slice(0, 200);
      if (x.default) field.default = String(x.default).slice(0, 100);
      if (lockedDef?.pattern) field.pattern = lockedDef.pattern;
      else if (PATTERNS[x.pattern]) field.pattern = x.pattern;
      if (['select', 'radio'].includes(type)) field.options = (Array.isArray(x.options) ? x.options : []).map((o) => String(o).trim().slice(0, 100)).filter(Boolean).slice(0, 100);
      if (type === 'file') field.accept = x.accept === 'image' ? 'image' : 'document';
      if (x.showIf?.field) {
        field.showIf = { field: String(x.showIf.field).slice(0, 50) };
        if (Array.isArray(x.showIf.levels)) field.showIf.levels = x.showIf.levels.map(Number).filter(Number.isInteger);
        if (Array.isArray(x.showIf.values)) field.showIf.values = x.showIf.values.map(String);
      }
      return [field];
    }),
  }));
  if (!sections.length) sections.push({ id: 'main', title: 'Application', fields: [] });
  for (const l of LOCKED) {
    if (!seen.has(l.key)) sections[0].fields.push({ ...l });
  }
  return {
    intro: String(input?.intro || '').slice(0, 1000),
    declaration: String(input?.declaration || '').slice(0, 1000),
    sections,
  };
}

const isVisible = (field, data, classLevel) => {
  if (!field.showIf) return true;
  if (field.showIf.levels) return field.showIf.levels.includes(classLevel);
  if (field.showIf.values) return field.showIf.values.includes(String(data[field.showIf.field] ?? ''));
  return true;
};

// Validates a submission against the form. Only fields defined on the form are kept.
export function validateSubmission(form, raw, uploadedKeys, classesById) {
  const errors = {};
  const data = {};
  const classLevel = classesById.get(Number(raw.class_applying))?.level;
  for (const field of allFields(form)) {
    if (!isVisible(field, raw, classLevel)) continue;
    if (field.type === 'file') {
      if (field.required && !uploadedKeys.has(field.key)) errors[field.key] = `${field.label} is required.`;
      continue;
    }
    const value = field.type === 'checkbox' ? Boolean(raw[field.key]) : String(raw[field.key] ?? '').trim().slice(0, field.type === 'textarea' ? 2000 : 300);
    if (field.required && !value) {
      errors[field.key] = `${field.label} is required.`;
      continue;
    }
    if (!value) continue;
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.key] = 'Enter a valid email address.';
    if (field.type === 'number' && !Number.isFinite(Number(value))) errors[field.key] = `${field.label} must be a number.`;
    if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors[field.key] = 'Enter a valid date.';
    if (['select', 'radio'].includes(field.type) && !(field.options || []).includes(value)) errors[field.key] = `Choose a valid ${field.label}.`;
    if (field.type === 'class' && !classesById.has(Number(value))) errors[field.key] = 'Choose a class that is open for admission.';
    if (field.pattern) {
      const [re, msg] = PATTERNS[field.pattern];
      if (!re.test(value)) errors[field.key] = `${field.label} ${msg}.`;
    }
    data[field.key] = value;
  }
  return { errors, data };
}
