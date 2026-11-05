// Starting subject list based on the NCTB structure. Everything here is editable in Admin > Academics.
// `paper` merges 1st and 2nd papers into one graded subject, as the education boards do.
const bangla = [
  { name: 'Bangla 1st Paper', code: '101', paper: 'Bangla' },
  { name: 'Bangla 2nd Paper', code: '102', paper: 'Bangla' },
];
const english = [
  { name: 'English 1st Paper', code: '107', paper: 'English' },
  { name: 'English 2nd Paper', code: '108', paper: 'English' },
];

const primaryEarly = [{ name: 'Bangla' }, { name: 'English' }, { name: 'Mathematics' }];

const primaryUpper = [
  ...primaryEarly,
  { name: 'Bangladesh and Global Studies' },
  { name: 'Primary Science' },
  { name: 'Religion and Moral Education' },
];

const juniorSecondary = [
  ...bangla,
  ...english,
  { name: 'Mathematics', code: '109' },
  { name: 'Science', code: '127' },
  { name: 'Bangladesh and Global Studies', code: '150' },
  { name: 'Religion and Moral Education', code: '111' },
  { name: 'Information and Communication Technology', code: '154' },
  { name: 'Agriculture Studies / Home Science', code: '134' },
  { name: 'Physical Education and Health', code: '147' },
  { name: 'Arts and Crafts' },
  { name: 'Work and Life-Oriented Education' },
];

const secondary = [
  ...bangla,
  ...english,
  { name: 'Mathematics', code: '109' },
  { name: 'Religion and Moral Education', code: '111' },
  { name: 'Information and Communication Technology', code: '154' },
  // Science group
  { name: 'Physics', code: '136', group: 'Science' },
  { name: 'Chemistry', code: '137', group: 'Science' },
  { name: 'Biology', code: '138', group: 'Science' },
  { name: 'Bangladesh and Global Studies', code: '150', group: 'Science' },
  { name: 'Higher Mathematics', code: '126', group: 'Science', optional: true },
  // Business Studies group
  { name: 'Accounting', code: '146', group: 'Business Studies' },
  { name: 'Finance and Banking', code: '152', group: 'Business Studies' },
  { name: 'Business Entrepreneurship', code: '143', group: 'Business Studies' },
  { name: 'General Science', code: '127', group: 'Business Studies' },
  // Humanities group
  { name: 'Geography and Environment', code: '110', group: 'Humanities' },
  { name: 'Civics and Citizenship', code: '140', group: 'Humanities' },
  { name: 'History of Bangladesh and World Civilisation', code: '153', group: 'Humanities' },
  { name: 'Economics', code: '141', group: 'Humanities' },
  { name: 'General Science', code: '127', group: 'Humanities' },
  // Fourth subject choices open to every group
  { name: 'Agriculture Studies', code: '134', optional: true },
  { name: 'Home Science', code: '151', optional: true },
];

export const GROUPS = ['Science', 'Business Studies', 'Humanities'];

export const CLASS_SUBJECTS = [
  { level: 1, subjects: primaryEarly },
  { level: 2, subjects: primaryEarly },
  { level: 3, subjects: primaryUpper },
  { level: 4, subjects: primaryUpper },
  { level: 5, subjects: primaryUpper },
  { level: 6, subjects: juniorSecondary },
  { level: 7, subjects: juniorSecondary },
  { level: 8, subjects: juniorSecondary },
  { level: 9, subjects: secondary },
  { level: 10, subjects: secondary },
];
