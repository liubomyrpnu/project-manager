// Політика паролів (Завдання 1 проєкту «Безпека програм та даних»):
// не менше 8 символів, великі й малі літери, цифра та символ (не літера і не цифра).
// Додатково: обмеження довжини, перелік поширених паролів, заборона використовувати пошту.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const RULES = [
  { id: 'length', message: `Щонайменше ${PASSWORD_MIN_LENGTH} символів`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'lower', message: 'Мала літера', test: (p) => /\p{Ll}/u.test(p) },
  { id: 'upper', message: 'Велика літера', test: (p) => /\p{Lu}/u.test(p) },
  { id: 'digit', message: 'Цифра', test: (p) => /\p{Nd}/u.test(p) },
  { id: 'symbol', message: 'Символ (не літера і не цифра), наприклад ! @ # %', test: (p) => /[^\p{L}\p{N}]/u.test(p) },
];

// Поширені паролі, які формально проходять політику, але першими перевіряються під час перебору.
const COMMON_PASSWORDS = new Set([
  'password1!', 'password123!', 'p@ssw0rd', 'p@ssw0rd1', 'p@ssword1', 'qwerty123!', 'qwerty1!',
  'qwerty12!', 'admin123!', 'admin@123', 'welcome1!', 'welcome123!', 'letmein1!', 'iloveyou1!',
  'abc123!@#', 'abcd1234!', 'passw0rd!', 'football1!', 'monkey123!', 'dragon123!', 'summer2026!',
  'winter2026!', 'test1234!', 'qwe123!@#', '1q2w3e4r!', '1qaz2wsx!', 'zaq12wsx!', 'changeme1!',
]);

export function checkPasswordPolicy(password, { email } = {}) {
  const value = typeof password === 'string' ? password : '';
  const failed = RULES.filter((rule) => !rule.test(value)).map((rule) => rule.message);

  if (value.length > PASSWORD_MAX_LENGTH) failed.push(`Не більше ${PASSWORD_MAX_LENGTH} символів`);
  if (COMMON_PASSWORDS.has(value.toLowerCase())) failed.push('Пароль занадто поширений — оберіть інший');

  const localPart = typeof email === 'string' ? email.split('@')[0].toLowerCase() : '';
  if (localPart.length >= 4 && value.toLowerCase().includes(localPart)) {
    failed.push('Пароль не повинен містити вашу пошту');
  }
  return failed;
}

export function passwordPolicyError(password, context) {
  const failed = checkPasswordPolicy(password, context);
  return failed.length ? `Пароль не відповідає вимогам: ${failed.join('; ')}` : '';
}

// Оцінка сили пароля від 0 (дуже слабкий) до 4 (сильний).
export function passwordStrength(password) {
  const value = typeof password === 'string' ? password : '';
  if (!value || COMMON_PASSWORDS.has(value.toLowerCase())) return 0;
  const passed = RULES.filter((rule) => rule.test(value)).length; // 0..5
  let score = Math.max(0, passed - 2); // 0..3
  if (passed === RULES.length && value.length >= 12) score += 1;
  return score;
}
