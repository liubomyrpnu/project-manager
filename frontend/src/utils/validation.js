// Функції валідації форм. Кожна повертає текст помилки або порожній рядок.
// Ті самі правила повторно перевіряються на сервері.

// Формат пошти перевіряється без регулярного виразу з повтореннями (захист від ReDoS,
// правило SonarQube S5852): одна «@», непорожня локальна частина, домен із крапкою.
function isEmailFormat(email) {
  if (email.length > 255 || /\s/.test(email)) return false;
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;
  const labels = email.slice(at + 1).split('.');
  return labels.length >= 2 && labels.every((label) => label.length > 0);
}

export function validateEmail(email) {
  const value = email.trim();
  if (!value) return 'Введіть електронну пошту';
  if (!isEmailFormat(value)) return 'Некоректний формат пошти';
  return '';
}

// Політика паролів: ≥ 8 символів, великі й малі літери, цифра, символ.
export const PASSWORD_RULES = [
  { id: 'length', label: 'Щонайменше 8 символів', test: (p) => p.length >= 8 },
  { id: 'lower', label: 'Мала літера', test: (p) => /\p{Ll}/u.test(p) },
  { id: 'upper', label: 'Велика літера', test: (p) => /\p{Lu}/u.test(p) },
  { id: 'digit', label: 'Цифра', test: (p) => /\p{Nd}/u.test(p) },
  { id: 'symbol', label: 'Символ (! @ # % …)', test: (p) => /[^\p{L}\p{N}]/u.test(p) },
];

export const passwordChecks = (password) => PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(password) }));

export function validateNewPassword(password) {
  if (!password) return 'Введіть пароль';
  const failed = passwordChecks(password).filter((check) => !check.ok);
  if (failed.length) return `Пароль не відповідає вимогам: ${failed.map((c) => c.label.toLowerCase()).join(', ')}`;
  if (password.length > 128) return 'Пароль не може бути довшим за 128 символів';
  return '';
}

export const validateLoginPassword = (password) => (password ? '' : 'Введіть пароль');

export const validateConfirm = (password, confirm) => (password === confirm ? '' : 'Паролі не збігаються');

// Сила пароля 0–4 (та сама формула, що на сервері).
export function passwordStrength(password) {
  if (!password) return 0;
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  let score = Math.max(0, passed - 2);
  if (passed === PASSWORD_RULES.length && password.length >= 12) score += 1;
  return score;
}

export const STRENGTH_LABELS = ['Дуже слабкий', 'Слабкий', 'Середній', 'Добрий', 'Сильний'];

export function validateName(name) {
  const value = name.trim();
  if (!value) return "Введіть ім'я";
  if (value.length < 2) return "Ім'я має містити щонайменше 2 символи";
  if (value.length > 100) return "Ім'я не може бути довшим за 100 символів";
  return '';
}

export function validateProjectName(name) {
  const value = name.trim();
  if (!value) return 'Введіть назву проєкту';
  if (value.length < 3) return 'Назва має містити щонайменше 3 символи';
  if (value.length > 150) return 'Назва не може бути довшою за 150 символів';
  return '';
}

export function validateTaskTitle(title) {
  const value = title.trim();
  if (!value) return 'Введіть назву завдання';
  if (value.length < 3) return 'Назва має містити щонайменше 3 символи';
  if (value.length > 200) return 'Назва не може бути довшою за 200 символів';
  return '';
}

export function validateDeadline(value) {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) return 'Некоректна дата';
  return '';
}

export const validateOtp = (code) => (/^\d{6}$/.test(code.replace(/\s/g, '')) ? '' : 'Код складається з 6 цифр');
