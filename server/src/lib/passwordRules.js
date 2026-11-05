// Password rules, with no other imports so the installer can use them before the site is configured.
const COMMON = ['password', '123456', 'qwerty', 'admin', 'school', 'letmein', 'welcome', 'bangladesh', 'iloveyou'];

export function passwordRuleProblem(password, email = '', min = 10) {
  const pw = String(password || '');
  if (pw.length < Number(min)) return `Password must be at least ${min} characters.`;
  if (pw.length > 200) return 'Password must be at most 200 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Password must include letters and numbers.';
  const lower = pw.toLowerCase();
  if (COMMON.some((c) => lower.includes(c))) return 'That password is too easy to guess.';
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return 'Password must not contain your email name.';
  return null;
}
