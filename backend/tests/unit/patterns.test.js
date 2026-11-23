import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SecurityEventPublisher, SecurityEvents, SecurityObserver } from '../../src/events/SecurityEventPublisher.js';
import { LoginAuditObserver } from '../../src/events/observers/LoginAuditObserver.js';
import { createCryptoBox } from '../../src/security/cryptoBox.js';
import { FixedLockoutPolicy, ProgressiveLockoutPolicy, createLockoutPolicy } from '../../src/security/lockoutPolicies.js';
import { hashPassword } from '../../src/security/password.js';
import { createAuthService } from '../../src/services/authService.js';

// Модульні тести патернів, впроваджених у лабораторній роботі №12.

const NOW = new Date('2026-11-23T10:00:00Z');
const minutesLater = (n) => new Date(NOW.getTime() + n * 60 * 1000).toISOString();

describe('Strategy: політики блокування акаунта', () => {
  test('UT-23: FixedLockoutPolicy — блокування на 15 хв після 5-ї спроби, лічильник обнуляється', () => {
    const policy = new FixedLockoutPolicy({ maxFailedLogins: 5, lockMinutes: 15 });
    let user = { failedLoginCount: 0 };
    for (let i = 1; i <= 4; i += 1) {
      const state = policy.onFailedAttempt(user, NOW);
      assert.deepEqual(state, { failedLoginCount: i, lockedUntil: null, lockedNow: false, attempts: i });
      user = state;
    }
    const fifth = policy.onFailedAttempt(user, NOW);
    assert.equal(fifth.lockedNow, true);
    assert.equal(fifth.attempts, 5);
    assert.equal(fifth.failedLoginCount, 0);
    assert.equal(fifth.lockedUntil.toISOString(), minutesLater(15));
  });

  test('UT-24: ProgressiveLockoutPolicy — з 3-ї спроби блокування 1, 2, 4 … хв, не більше 60', () => {
    const policy = new ProgressiveLockoutPolicy({ threshold: 3, baseMinutes: 1, maxMinutes: 60 });
    assert.equal(policy.onFailedAttempt({ failedLoginCount: 1 }, NOW).lockedNow, false);

    const expected = { 2: 1, 3: 2, 4: 4, 5: 8, 9: 60 }; // попередні спроби → хвилини блокування
    for (const [previous, minutes] of Object.entries(expected)) {
      const state = policy.onFailedAttempt({ failedLoginCount: Number(previous) }, NOW);
      assert.equal(state.lockedNow, true);
      assert.equal(state.failedLoginCount, Number(previous) + 1, 'лічильник не обнуляється');
      assert.equal(state.lockedUntil.toISOString(), minutesLater(minutes));
    }
  });

  test('UT-25: стратегія обирається за назвою з конфігурації', () => {
    const fixed = createLockoutPolicy({ lockoutPolicy: 'fixed', maxFailedLogins: 4, lockMinutes: 10 });
    assert.ok(fixed instanceof FixedLockoutPolicy);
    assert.equal(fixed.maxFailedLogins, 4);
    assert.ok(createLockoutPolicy({ lockoutPolicy: 'progressive' }) instanceof ProgressiveLockoutPolicy);
    assert.ok(createLockoutPolicy({}) instanceof FixedLockoutPolicy, 'за замовчуванням — fixed');
    assert.throws(() => createLockoutPolicy({ lockoutPolicy: 'forever' }), /Невідома політика/);
  });
});

describe('Observer: події безпеки', () => {
  class Recorder extends SecurityObserver {
    events = [];
    async update(event) {
      this.events.push(event);
    }
  }

  test('UT-26: видавець сповіщає всіх підписаних спостерігачів; після відписки — ні', async () => {
    const publisher = new SecurityEventPublisher();
    const first = new Recorder();
    const second = new Recorder();
    publisher.subscribe(first).subscribe(second);
    await publisher.notify(SecurityEvents.LOGIN_FAILED, { email: 'a@b.com', reason: 'wrong_password' });
    assert.equal(first.events.length, 1);
    assert.equal(second.events[0].type, 'login.failed');
    assert.ok(second.events[0].occurredAt instanceof Date);

    publisher.unsubscribe(first);
    await publisher.notify(SecurityEvents.LOGIN_SUCCEEDED, {});
    assert.equal(first.events.length, 1);
    assert.equal(second.events.length, 2);
    assert.throws(() => publisher.subscribe({}), TypeError);
  });

  test('UT-27: помилка одного спостерігача не заважає іншим', async () => {
    const publisher = new SecurityEventPublisher();
    const broken = { update: async () => { throw new Error('БД недоступна'); } };
    const recorder = new Recorder();
    publisher.subscribe(broken).subscribe(recorder);
    const originalError = console.error;
    console.error = () => {};
    try {
      await publisher.notify(SecurityEvents.LOGIN_FAILED, {});
    } finally {
      console.error = originalError;
    }
    assert.equal(recorder.events.length, 1);
  });

  test('UT-28: LoginAuditObserver записує лише спроби входу', async () => {
    const saved = [];
    const observer = new LoginAuditObserver({ add: async (entry) => saved.push(entry) });
    const context = { ip: '10.0.0.5', userAgent: 'test' };
    await observer.update({ type: SecurityEvents.LOGIN_FAILED, user: null, email: 'ghost@x.com', method: 'password', reason: 'unknown_email', context });
    await observer.update({ type: SecurityEvents.ACCOUNT_LOCKED, user: { id: 'u1' } });
    assert.deepEqual(saved, [
      { userId: null, email: 'ghost@x.com', ip: '10.0.0.5', userAgent: 'test', method: 'password', success: false, reason: 'unknown_email' },
    ]);
  });
});

describe('AuthService з патернами Strategy та Observer', () => {
  async function setup(lockoutPolicy) {
    const user = {
      id: 'u1', name: 'Іван', email: 'ivan@example.com', passwordHash: await hashPassword('Str0ng!Pass'),
      isActivated: true, isBlocked: false, totpEnabled: false, tokenVersion: 0, failedLoginCount: 0, lockedUntil: null,
    };
    const users = {
      findByEmail: async () => user,
      updateLoginState: async (id, state) => Object.assign(user, state),
    };
    const publisher = new SecurityEventPublisher();
    const recorder = { events: [], update: async (event) => recorder.events.push(event.type) };
    publisher.subscribe(recorder); // новий спостерігач, про якого AuthService нічого не знає
    const service = createAuthService({
      users, tokens: {}, events: publisher, lockoutPolicy, mail: {}, captcha: {},
      cryptoBox: createCryptoBox('ab'.repeat(32)),
      config: { jwtSecret: 'unit-test-secret-unit-test-secret-1234', accessTokenTtlSec: 60, security: {} },
      now: () => NOW,
    });
    return { service, recorder, user };
  }
  const ctx = { ip: '127.0.0.1', userAgent: 'node-test' };
  const wrongLogin = (service) => service.login({ email: 'ivan@example.com', password: 'Wrong!Pass1' }, ctx);

  test('UT-29: заміна стратегії змінює поведінку сервісу без зміни його коду', async () => {
    const { service, user } = await setup(new ProgressiveLockoutPolicy());
    await assert.rejects(wrongLogin(service), { status: 401 });
    await assert.rejects(wrongLogin(service), { status: 401 });
    await assert.rejects(wrongLogin(service), { status: 429, message: /Забагато невдалих спроб \(3\)/ });
    assert.equal(new Date(user.lockedUntil).toISOString(), minutesLater(1));
  });

  test('UT-30: сервіс публікує події входу та блокування для всіх спостерігачів', async () => {
    const { service, recorder } = await setup(new FixedLockoutPolicy({ maxFailedLogins: 2, lockMinutes: 5 }));
    await assert.rejects(wrongLogin(service), { status: 401 });
    await assert.rejects(wrongLogin(service), { status: 429 });
    assert.deepEqual(recorder.events, ['login.failed', 'login.failed', 'account.locked']);
  });
});
