import { hashPassword } from '../src/security/password.js';

// Тестові дані (ті самі користувачі, проєкти й завдання, що в лабораторній №5).
// Пароль усіх тестових користувачів відповідає політиці паролів.
export const SEED_PASSWORD = 'Password123!';

export const SEED_USERS = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Олена Коваль', email: 'olena@example.com', role: 'admin' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Андрій Мельник', email: 'andriy@example.com', role: 'user' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Марія Шевчук', email: 'maria@example.com', role: 'user' },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Ігор Бондар', email: 'igor@example.com', role: 'user' },
];

const P1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const P2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const MEMBERS = [
  [P1, SEED_USERS[1].id, 'manager'],
  [P1, SEED_USERS[2].id, 'member'],
  [P1, SEED_USERS[3].id, 'member'],
  [P2, SEED_USERS[2].id, 'manager'],
  [P2, SEED_USERS[1].id, 'member'],
];

// Дедлайни рахуються від сьогоднішньої дати, щоб на дошці завжди були
// прострочені, «скоро дедлайн» і звичайні завдання (FR-12).
const TASKS = [
  ['c0000000-0000-0000-0000-000000000001', P1, 'Підготувати макети', 'Макети головної та каталогу', -6, 'done', 2],
  ['c0000000-0000-0000-0000-000000000002', P1, 'Верстка головної сторінки', 'Адаптивна верстка за макетом', 2, 'in_progress', 2],
  ['c0000000-0000-0000-0000-000000000003', P1, 'Налаштувати хостинг', 'Домен, SSL-сертифікат, деплой', -1, 'todo', 3],
  ['c0000000-0000-0000-0000-000000000004', P1, 'Тестування сайту', 'Перевірка в різних браузерах', 12, 'todo', 3],
  ['c0000000-0000-0000-0000-000000000005', P2, 'Описати вимоги', 'Функціональні та нефункціональні вимоги', -10, 'done', 1],
  ['c0000000-0000-0000-0000-000000000006', P2, 'Прототип екрана входу', null, 3, 'in_progress', 1],
  ['c0000000-0000-0000-0000-000000000007', P2, 'Вибір технологічного стеку', null, 8, 'todo', 2],
];

function dateFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function seed(db) {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  for (const user of SEED_USERS) {
    await db.query(
      `INSERT INTO users (id, name, email, password_hash, system_role, is_activated) VALUES ($1, $2, $3, $4, $5, true)`,
      [user.id, user.name, user.email, passwordHash, user.role]
    );
  }
  await db.query(
    `INSERT INTO projects (id, name, description) VALUES ($1, 'Редизайн сайту', 'Оновлення корпоративного сайту'),
                                                        ($2, 'Мобільний застосунок', 'Розробка MVP')`,
    [P1, P2]
  );
  for (const [projectId, userId, role] of MEMBERS) {
    await db.query(`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)`, [projectId, userId, role]);
  }
  for (const [id, projectId, title, description, days, status, userIndex] of TASKS) {
    await db.query(
      `INSERT INTO tasks (id, project_id, title, description, deadline, status, assignee_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, projectId, title, description, dateFromToday(days), status, SEED_USERS[userIndex].id]
    );
  }
}
