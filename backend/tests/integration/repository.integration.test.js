import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { resetDatabase } from '../../scripts/dbTools.js';
import { createPool } from '../../src/db/pool.js';
import { createProjectRepository } from '../../src/repositories/projectRepository.js';
import { createTaskRepository } from '../../src/repositories/taskRepository.js';
import { createUserRepository } from '../../src/repositories/userRepository.js';
import { testDatabaseUrl } from '../helpers/testServer.js';

// Інтеграційні тести рівня «репозиторій ↔ база даних» (без HTTP).

describe('Репозиторії та PostgreSQL', () => {
  let db;
  let users;
  let projects;
  let tasks;

  before(async () => {
    const url = testDatabaseUrl();
    await resetDatabase(url, { withSeed: false });
    db = createPool(url);
    users = createUserRepository(db);
    projects = createProjectRepository(db);
    tasks = createTaskRepository(db);
  });
  after(async () => {
    await db?.end();
  });

  test('IT-001: користувач зберігається в БД і читається за ідентифікатором', async () => {
    const created = await users.create({ name: 'Іван Петренко', email: 'ivan@example.com', passwordHash: 'scrypt$hash' });
    const found = await users.findById(created.id);
    assert.equal(found.name, 'Іван Петренко');
    assert.equal(found.email, 'ivan@example.com');
    assert.equal(found.isActivated, false);
    assert.equal(found.systemRole, 'user');
  });

  test('IT-002: проєкт створюється разом із менеджером в одній операції', async () => {
    const manager = await users.findByEmail('ivan@example.com');
    const project = await projects.createWithManager({ name: 'Проєкт ІПЗ-41', description: null, managerId: manager.id });
    const members = await projects.listMembers(project.id);
    assert.equal(members.length, 1);
    assert.equal(members[0].userId, manager.id);
    assert.equal(members[0].role, 'manager');
    assert.equal(await projects.findMemberRole(project.id, manager.id), 'manager');
  });

  test('IT-003: завдання зберігає дедлайн як дату без зсуву часового поясу', async () => {
    const manager = await users.findByEmail('ivan@example.com');
    const [project] = await projects.listForUser(manager.id);
    const task = await tasks.create({
      projectId: project.id,
      title: 'Написати звіт',
      description: null,
      deadline: '2026-12-31',
      status: 'todo',
      assigneeId: manager.id,
    });
    assert.equal(task.deadline, '2026-12-31');
    assert.equal(task.assigneeName, 'Іван Петренко');
    assert.equal(task.projectName, 'Проєкт ІПЗ-41');
  });

  test('Обмеження БД: дублікат пошти відхиляється (UNIQUE)', async () => {
    await assert.rejects(users.create({ name: 'Дублікат', email: 'ivan@example.com' }), { code: '23505' });
  });
});
