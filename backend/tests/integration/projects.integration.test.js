import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startTestServer } from '../helpers/testServer.js';

// Інтеграційні тести проєктів, учасників і завдань (REST API + PostgreSQL).
// Тестові дані: Андрій — менеджер «Редизайн сайту», Марія та Ігор — учасники.

const P1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const IGOR = '44444444-4444-4444-4444-444444444444';
const MARIA = '33333333-3333-3333-3333-333333333333';

describe('Проєкти та завдання (API + БД)', () => {
  let env;
  let andriy;
  let maria;
  let igor;
  let olena;

  before(async () => {
    env = await startTestServer();
    [andriy, maria, igor, olena] = await Promise.all(
      ['andriy', 'maria', 'igor', 'olena'].map((name) => env.login(`${name}@example.com`))
    );
  });
  after(async () => {
    await env?.close();
  });

  test('Список проєктів містить роль користувача та статистику', async () => {
    const res = await env.api('GET', '/projects', { token: andriy });
    assert.equal(res.status, 200);
    assert.equal(res.data.length, 2);
    const redesign = res.data.find((p) => p.id === P1);
    assert.equal(redesign.myRole, 'manager');
    assert.equal(redesign.taskCount, 4);
    assert.equal(redesign.memberCount, 3);
  });

  test('Створення проєкту: автор стає менеджером (201)', async () => {
    const res = await env.api('POST', '/projects', { token: olena, body: { name: 'Внутрішній портал', description: '  ' } });
    assert.equal(res.status, 201);
    assert.equal(res.data.myRole, 'manager');
    assert.equal(res.data.description, null);
    const members = await env.api('GET', `/projects/${res.data.id}/members`, { token: olena });
    assert.deepEqual(members.data.map((m) => m.role), ['manager']);
  });

  test('Валідація: коротка назва проєкту — 400 з помилкою поля', async () => {
    const res = await env.api('POST', '/projects', { token: andriy, body: { name: 'AB' } });
    assert.equal(res.status, 400);
    assert.ok(res.data.errors.name);
  });

  test('Користувач, що не є учасником, не бачить проєкт (403), неіснуючий проєкт — 404', async () => {
    assert.equal((await env.api('GET', `/projects/${P1}`, { token: olena })).status, 403);
    assert.equal((await env.api('GET', '/projects/00000000-0000-0000-0000-000000000000', { token: olena })).status, 404);
    assert.equal((await env.api('GET', '/projects/not-a-uuid', { token: olena })).status, 404);
  });

  test('Учасник не може редагувати проєкт (403), менеджер — може', async () => {
    const body = { name: 'Редизайн сайту 2.0', description: 'Оновлення' };
    assert.equal((await env.api('PUT', `/projects/${P1}`, { token: maria, body })).status, 403);
    const res = await env.api('PUT', `/projects/${P1}`, { token: andriy, body });
    assert.equal(res.data.name, 'Редизайн сайту 2.0');
  });

  test('Менеджер додає учасника за поштою; дублікат — 409, невідома пошта — 404', async () => {
    const add = await env.api('POST', `/projects/${P1}/members`, { token: andriy, body: { email: 'OLENA@example.com' } });
    assert.equal(add.status, 201);
    assert.ok(add.data.some((m) => m.email === 'olena@example.com' && m.role === 'member'));
    assert.equal((await env.api('POST', `/projects/${P1}/members`, { token: andriy, body: { email: 'olena@example.com' } })).status, 409);
    assert.equal((await env.api('POST', `/projects/${P1}/members`, { token: andriy, body: { email: 'ghost@example.com' } })).status, 404);
  });

  test('Завдання не можна призначити користувачу поза проєктом (400)', async () => {
    const res = await env.api('POST', `/projects/${P1}/tasks`, {
      token: andriy,
      body: { title: 'Сторонній виконавець', assigneeId: '11111111-1111-1111-1111-111111111112' },
    });
    assert.equal(res.status, 400);
    assert.ok(res.data.errors.assigneeId);
  });

  test('Створення завдання менеджером і перегляд на дошці', async () => {
    const res = await env.api('POST', `/projects/${P1}/tasks`, {
      token: andriy,
      body: { title: 'Налаштувати аналітику', description: 'GA4', deadline: '2026-12-20', assigneeId: IGOR },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.status, 'todo');
    assert.equal(res.data.deadline, '2026-12-20');
    assert.equal(res.data.assigneeName, 'Ігор Бондар');

    const board = await env.api('GET', `/projects/${P1}/tasks`, { token: maria });
    assert.ok(board.data.some((t) => t.id === res.data.id));
  });

  test('Некоректна дата дедлайну — 400', async () => {
    const res = await env.api('POST', `/projects/${P1}/tasks`, {
      token: andriy,
      body: { title: 'Погана дата', deadline: '2026-02-30', assigneeId: IGOR },
    });
    assert.equal(res.status, 400);
    assert.ok(res.data.errors.deadline);
  });

  test('Статус змінює виконавець або менеджер; інший учасник — 403', async () => {
    const board = await env.api('GET', `/projects/${P1}/tasks`, { token: andriy });
    const igorTask = board.data.find((t) => t.assigneeId === IGOR);

    assert.equal((await env.api('PATCH', `/tasks/${igorTask.id}`, { token: maria, body: { status: 'done' } })).status, 403);
    const byAssignee = await env.api('PATCH', `/tasks/${igorTask.id}`, { token: igor, body: { status: 'in_progress' } });
    assert.equal(byAssignee.data.status, 'in_progress');
    const invalid = await env.api('PATCH', `/tasks/${igorTask.id}`, { token: igor, body: { status: 'archived' } });
    assert.equal(invalid.status, 400);
  });

  test('Мої завдання: лише власні завдання з назвою проєкту', async () => {
    const res = await env.api('GET', '/tasks/my', { token: maria });
    assert.equal(res.status, 200);
    assert.ok(res.data.length > 0);
    assert.ok(res.data.every((t) => t.assigneeId === MARIA && t.projectName));
    assert.ok(res.data.every((t) => ['overdue', 'soon', 'ok', 'none'].includes(t.deadlineState)));
  });

  test('Не можна видалити учасника з завданнями та єдиного менеджера (409)', async () => {
    assert.equal((await env.api('DELETE', `/projects/${P1}/members/${MARIA}`, { token: andriy })).status, 409);
    const managerId = '22222222-2222-2222-2222-222222222222';
    assert.equal((await env.api('DELETE', `/projects/${P1}/members/${managerId}`, { token: andriy })).status, 409);
  });

  test('Видалення проєкту каскадно видаляє завдання та учасників', async () => {
    const created = await env.api('POST', '/projects', { token: maria, body: { name: 'Тимчасовий проєкт' } });
    await env.api('POST', `/projects/${created.data.id}/tasks`, { token: maria, body: { title: 'Завдання', assigneeId: MARIA } });

    assert.equal((await env.api('DELETE', `/projects/${created.data.id}`, { token: maria })).status, 204);
    const { rows } = await env.db.query(
      `SELECT (SELECT count(*)::int FROM tasks WHERE project_id = $1) AS tasks,
              (SELECT count(*)::int FROM project_members WHERE project_id = $1) AS members`,
      [created.data.id]
    );
    assert.deepEqual(rows[0], { tasks: 0, members: 0 });
  });

  test('Некоректний JSON у тілі запиту — 400', async () => {
    const res = await env.api('POST', '/projects', {
      token: andriy,
      headers: { 'Content-Type': 'application/json' },
      rawBody: '{"name": "Без лапок}',
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.message, 'Некоректний JSON у тілі запиту');
  });
});
