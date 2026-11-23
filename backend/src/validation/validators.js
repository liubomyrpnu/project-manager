// Серверна валідація вхідних даних (FR-14, NFR-07).
// Кожна функція повертає текст помилки або порожній рядок.

export const TASK_STATUSES = ['todo', 'in_progress', 'done'];
export const PROJECT_ROLES = ['manager', 'member'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

export const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

export function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return 'Введіть електронну пошту';
  if (email.length > 255 || !EMAIL_RE.test(email)) return 'Некоректний формат пошти';
  return '';
}

export function validateText(value, { label, min = 0, max, required = true }) {
  if (value !== undefined && value !== null && typeof value !== 'string') return `Поле «${label}» має бути текстом`;
  const text = (value ?? '').trim();
  if (!text) return required ? `Заповніть поле «${label}»` : '';
  if (text.length < min) return `Поле «${label}» має містити щонайменше ${min} символи`;
  if (max && text.length > max) return `Поле «${label}» не може бути довшим за ${max} символів`;
  return '';
}

export const validateName = (value) => validateText(value, { label: "Ім'я", min: 2, max: 100 });

// Дата у форматі РРРР-ММ-ДД, яка реально існує (без 2026-02-30).
export function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateDeadline(value) {
  if (value === undefined || value === null || value === '') return '';
  return isValidDateString(value) ? '' : 'Некоректна дата дедлайну (очікується РРРР-ММ-ДД)';
}

export const validateStatus = (value) =>
  TASK_STATUSES.includes(value) ? '' : `Статус має бути одним із: ${TASK_STATUSES.join(', ')}`;

export const validateProjectRole = (value) =>
  PROJECT_ROLES.includes(value) ? '' : `Роль має бути однією з: ${PROJECT_ROLES.join(', ')}`;

export const trimOrNull = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
};

// Стан дедлайну завдання (FR-12): прострочено, скоро (≤ 3 днів), нормально, без дедлайну.
export function getDeadlineState(deadline, status, today = new Date()) {
  if (!deadline || status === 'done') return 'none';
  const todayString = toDateString(today);
  if (deadline < todayString) return 'overdue';
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 3);
  return deadline <= toDateString(limit) ? 'soon' : 'ok';
}

export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
