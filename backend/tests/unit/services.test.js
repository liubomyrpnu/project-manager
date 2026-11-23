import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SecurityEventPublisher } from '../../src/events/SecurityEventPublisher.js';
import { AccountLockedMailObserver } from '../../src/events/observers/AccountLockedMailObserver.js';
import { LoginAuditObserver } from '../../src/events/observers/LoginAuditObserver.js';
import { memoryTransport } from '../../src/mail/mailService.js';
import { FixedLockoutPolicy } from '../../src/security/lockoutPolicies.js';
import { createCryptoBox } from '../../src/security/cryptoBox.js';
import { hashPassword } from '../../src/security/password.js';
import { createAuthService } from '../../src/services/authService.js';
import { createTaskService } from '../../src/services/taskService.js';

// Модульні тести сервісів: репозиторії замінено простими об'єктами в пам'яті,
// тому перевіряється лише бізнес-логіка без бази даних.

const config = {
  jwtSecret: 'unit-test-secret-unit-test-secret-1234',
  accessTokenTtlSec: 3600,
  frontendUrl: 'http://localhost:5173',
  security: { maxFailedLogins: 3, lockMinutes: 15, activationTtlHours: 24, resetTtlMinutes: 30, twoFactorChallengeMinutes: 5 },
};

function fakeUsers(list) {
  const byId = new Map(list.map((u) => [u.id, { tokenVersion: 0, failedLoginCount: 0, lockedUntil: null, ...u }]));
  const update = (id, patch) => {
    const user = { ...byId.get(id), ...patch };
    byId.set(id, user);
    return user;
  };
  return {
    findById: async (id) => byId.get(id) || null,
    findByEmail: async (email) => [...byId.values()].find((u) => u.email === email) || null,
    updateLoginState: async (id, state) => update(id, state),
    recordSuccessfulLogin: async (id) => update(id, { failedLoginCount: 0, lockedUntil: null }),
  };
}

const ctx = { ip: '127.0.0.1', userAgent: 'node-test' };

describe('AuthService (модульні тести)', () => {
  async function setup() {
    const users = fakeUsers([
      { id: 'u1', name: 'Іван', email: 'ivan@example.com', passwordHash: await hashPassword('Str0ng!Pass'), isActivated: true, isBlocked: false, totpEnabled: false },
    ]);
    const log = [];
    const mail = memoryTransport();
    const events = new SecurityEventPublisher()
      .subscribe(new LoginAuditObserver({ add: async (entry) => log.push(entry) }))
      .subscribe(new AccountLockedMailObserver(mail));
    const service = createAuthService({
      users,
      tokens: {},
      events,
      lockoutPolicy: new FixedLockoutPolicy({ maxFailedLogins: 3, lockMinutes: 15 }),
      mail,
      captcha: {},
      cryptoBox: createCryptoBox('ab'.repeat(32)),
      config,
    });
    return { service, log, mail, users };
  }

  test('UT-17: правильні дані повертають токен, а спроба записується в журнал', async () => {
    const { service, log } = await setup();
    const result = await service.login({ email: ' IVAN@example.com ', password: 'Str0ng!Pass' }, ctx);
    assert.ok(result.token);
    assert.equal(result.user.email, 'ivan@example.com');
    assert.deepEqual(log.at(-1), { userId: 'u1', email: 'ivan@example.com', method: 'password', success: true, reason: 'ok', ...ctx });
  });

  test('UT-18: невідома пошта і неправильний пароль дають однакову помилку 401', async () => {
    const { service, log } = await setup();
    await assert.rejects(service.login({ email: 'ghost@example.com', password: 'Str0ng!Pass' }, ctx), {
      status: 401,
      message: 'Невірна пошта або пароль',
    });
    await assert.rejects(service.login({ email: 'ivan@example.com', password: 'Wrong!Pass1' }, ctx), {
      status: 401,
      message: 'Невірна пошта або пароль',
    });
    assert.deepEqual(log.map((e) => e.reason), ['unknown_email', 'wrong_password']);
  });

  test('UT-19: після ліміту невдалих спроб — блокування (429) і лист власнику', async () => {
    const { service, mail } = await setup();
    for (let i = 0; i < 2; i += 1) {
      await assert.rejects(service.login({ email: 'ivan@example.com', password: 'Wrong!Pass1' }, ctx), { status: 401 });
    }
    await assert.rejects(service.login({ email: 'ivan@example.com', password: 'Wrong!Pass1' }, ctx), { status: 429 });
    await assert.rejects(service.login({ email: 'ivan@example.com', password: 'Str0ng!Pass' }, ctx), { status: 429 });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(mail.sent[0].subject, 'Обліковий запис тимчасово заблоковано');
  });

  test('UT-20: порожні поля форми входу — 400 з помилками полів', async () => {
    const { service } = await setup();
    await assert.rejects(service.login({ email: '', password: '' }, ctx), (err) => {
      assert.equal(err.status, 400);
      assert.deepEqual(Object.keys(err.errors), ['email', 'password']);
      return true;
    });
  });
});

describe('TaskService (модульні тести)', () => {
  const TASK_ID = 'c0000000-0000-0000-0000-000000000001';
  const task = { id: TASK_ID, projectId: 'p1', assigneeId: 'u2', status: 'todo', deadline: null };
  const roles = { u1: 'manager', u2: 'member', u3: 'member' };
  const service = createTaskService({
    tasks: {
      findById: async (taskId) => (taskId === TASK_ID ? task : null),
      updateStatus: async (id, status) => ({ ...task, status }),
    },
    projects: { findMemberRole: async (projectId, userId) => roles[userId] || null },
    projectService: {},
  });
  const id = TASK_ID;

  test('UT-21: статус змінює виконавець і менеджер, інший учасник отримує 403', async () => {
    assert.equal((await service.changeStatus({ id: 'u2' }, id, { status: 'in_progress' })).status, 'in_progress');
    assert.equal((await service.changeStatus({ id: 'u1' }, id, { status: 'done' })).status, 'done');
    await assert.rejects(service.changeStatus({ id: 'u3' }, id, { status: 'done' }), { status: 403 });
    await assert.rejects(service.changeStatus({ id: 'u9' }, id, { status: 'done' }), { status: 403 });
  });

  test('UT-22: недопустимий статус — 400, неіснуюче завдання — 404', async () => {
    await assert.rejects(service.changeStatus({ id: 'u2' }, id, { status: 'archived' }), { status: 400 });
    await assert.rejects(
      service.changeStatus({ id: 'u2' }, '00000000-0000-0000-0000-000000000000', { status: 'done' }),
      { status: 404 }
    );
  });
});
