// Допоміжні функції для роботи з дедлайнами.

// Повертає дату у форматі РРРР-ММ-ДД за локальним часом.
export function toDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Стан дедлайну: 'overdue' (прострочено), 'soon' (найближчі 3 дні), 'ok' або 'none'.
export function getDeadlineState(deadline, status, today = new Date()) {
  if (!deadline || status === 'done') return 'none';
  if (deadline < toDateString(today)) return 'overdue';
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 3);
  if (deadline <= toDateString(limit)) return 'soon';
  return 'ok';
}

export const DEADLINE_LABELS = {
  overdue: 'Прострочено',
  soon: 'Скоро дедлайн',
  ok: '',
  none: '',
};

// 2026-10-15 -> 15.10.2026
export function formatDate(deadline) {
  if (!deadline) return 'Без дедлайну';
  const [year, month, day] = deadline.split('-');
  return `${day}.${month}.${year}`;
}

// Дата й час для журналів: 23.11.2026, 14:05
export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
