import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createCaptchaStore } from '../../src/security/captcha.js';
import { createCryptoBox, hashToken } from '../../src/security/cryptoBox.js';
import { signJwt, verifyJwt } from '../../src/security/jwt.js';
import { FixedLockoutPolicy } from '../../src/security/lockoutPolicies.js';
import { isTemporarilyLocked } from '../../src/security/loginGuard.js';
import { hashPassword, verifyPassword } from '../../src/security/password.js';
import { base32Decode, base32Encode, hotp, verifyTotp } from '../../src/security/totp.js';

const SECRET = 'unit-test-secret-unit-test-secret-1234';

describe('Хешування паролів (scrypt)', () => {
  test('UT-05: хеш перевіряється правильним паролем і не перевіряється неправильним', async () => {
    const hash = await hashPassword('Str0ng!Pass');
    assert.match(hash, /^scrypt\$32768\$8\$1\$/);
    assert.equal(await verifyPassword('Str0ng!Pass', hash), true);
    assert.equal(await verifyPassword('str0ng!Pass', hash), false);
  });

  test('UT-06: однакові паролі мають різні хеші завдяки солі', async () => {
    assert.notEqual(await hashPassword('Str0ng!Pass'), await hashPassword('Str0ng!Pass'));
  });
});

describe('JWT (HS256)', () => {
  test('UT-07: підписаний токен перевіряється, підроблений або прострочений — ні', () => {
    const now = Date.now();
    const token = signJwt({ sub: 'u1', purpose: 'access' }, SECRET, 60, now);
    assert.equal(verifyJwt(token, SECRET, now).sub, 'u1');

    const [h, , s] = token.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999 })).toString('base64url');
    assert.throws(() => verifyJwt(`${h}.${forgedBody}.${s}`, SECRET, now), /підпис/);
    assert.throws(() => verifyJwt(token, 'other-secret-other-secret-other-secret', now), /підпис/);
    assert.throws(() => verifyJwt(token, SECRET, now + 61_000), /Термін дії/);
  });
});

describe('TOTP (RFC 6238)', () => {
  test('UT-08: відповідає тестовим векторам RFC 6238 (SHA-1, 8 цифр)', () => {
    const key = Buffer.from('12345678901234567890');
    const vectors = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
    ];
    for (const [seconds, expected] of vectors) assert.equal(hotp(key, Math.floor(seconds / 30), 8), expected);
  });

  test('UT-09: Base32 кодування оборотне; код з вікна ±30 с приймається, повторний — ні', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    assert.equal(secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    assert.equal(base32Decode(secret).toString(), '12345678901234567890');

    const time = 1_800_000_000_000;
    const code = hotp(base32Decode(secret), Math.floor(time / 30_000));
    const step = verifyTotp(secret, code, { time: time + 25_000 });
    assert.equal(step, Math.floor(time / 30_000));
    assert.equal(verifyTotp(secret, code, { time, lastUsedStep: step }), null, 'replay');
    assert.equal(verifyTotp(secret, code, { time: time + 120_000 }), null, 'застарілий код');
    assert.equal(verifyTotp(secret, 'abc123', { time }), null);
  });
});

describe('Шифрування секретів, токени, CAPTCHA, блокування', () => {
  test('UT-10: AES-256-GCM шифрує й розшифровує, а змінені дані не розшифровуються', () => {
    const box = createCryptoBox('ab'.repeat(32));
    const encrypted = box.encrypt('JBSWY3DPEHPK3PXP');
    assert.notEqual(encrypted, box.encrypt('JBSWY3DPEHPK3PXP'), 'випадковий IV');
    assert.equal(box.decrypt(encrypted), 'JBSWY3DPEHPK3PXP');
    const parts = encrypted.split(':');
    parts[3] = Buffer.from('tampered').toString('base64');
    assert.throws(() => box.decrypt(parts.join(':')));
    assert.equal(hashToken('abc').length, 64);
  });

  test('UT-11: CAPTCHA одноразова, нечутлива до регістру й має термін дії', () => {
    let now = 0;
    const store = createCaptchaStore({ ttlMs: 1000, now: () => now });
    const first = store.create('K7M9X');
    assert.ok(!first.svg.includes('K7M9X'));
    assert.equal(store.verify(first.captchaId, ' k7m9x '), true);
    assert.equal(store.verify(first.captchaId, 'K7M9X'), false, 'повторно не працює');

    const second = store.create('CEFHK');
    assert.equal(store.verify(second.captchaId, 'CEFHM'), false);
    assert.equal(store.verify(second.captchaId, 'CEFHK'), false, 'після невдалої спроби CAPTCHA видаляється');

    const third = store.create('HKMNP');
    now = 2000;
    assert.equal(store.verify(third.captchaId, 'HKMNP'), false, 'термін дії минув');
  });

  test('UT-12: акаунт блокується після 5-ї невдалої спроби на 15 хвилин', () => {
    const policy = new FixedLockoutPolicy({ maxFailedLogins: 5, lockMinutes: 15 });
    const now = new Date('2026-11-23T10:00:00Z');
    let user = { failedLoginCount: 0, lockedUntil: null };
    for (let i = 1; i <= 4; i += 1) {
      user = { ...user, ...policy.onFailedAttempt(user, now) };
      assert.equal(user.failedLoginCount, i);
      assert.equal(isTemporarilyLocked(user, now), false);
    }
    const fifth = policy.onFailedAttempt(user, now);
    assert.equal(fifth.lockedNow, true);
    assert.equal(fifth.lockedUntil.toISOString(), '2026-11-23T10:15:00.000Z');
    assert.equal(isTemporarilyLocked(fifth, now), true);
    assert.equal(isTemporarilyLocked(fifth, new Date('2026-11-23T10:15:01Z')), false);
  });
});
