import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { generateTotp } from '../../src/security/totp.js';
import { CAPTCHA_ANSWER, startTestServer } from '../helpers/testServer.js';

// Інтеграційні тести системи облікових записів: HTTP → контролер → сервіс → PostgreSQL.

describe('Система облікових записів (API + БД)', () => {
  let env;
  const newUser = { name: 'Тестовий Користувач', email: 'new.user@example.com', password: 'Str0ng!Pass' };

  before(async () => {
    env = await startTestServer();
  });
  after(async () => {
    await env?.close();
  });

  const captcha = async () => (await env.api('GET', '/auth/captcha')).data;

  test('CAPTCHA повертається як SVG-зображення', async () => {
    const res = await env.api('GET', '/auth/captcha');
    assert.equal(res.status, 200);
    assert.ok(res.data.captchaId);
    assert.match(res.data.svg, /^<svg/);
    assert.ok(!res.data.svg.includes(CAPTCHA_ANSWER), 'відповідь не повинна бути текстом у SVG');
  });

  test('Реєстрація зі слабким паролем відхиляється політикою паролів (400)', async () => {
    const { captchaId } = await captcha();
    const res = await env.api('POST', '/auth/register', {
      body: { ...newUser, password: 'password', captchaId, captchaAnswer: CAPTCHA_ANSWER },
    });
    assert.equal(res.status, 400);
    assert.match(res.data.errors.password, /Велика літера/);
    assert.match(res.data.errors.password, /Цифра/);
  });

  test('Реєстрація з невірною CAPTCHA відхиляється (400)', async () => {
    const { captchaId } = await captcha();
    const res = await env.api('POST', '/auth/register', { body: { ...newUser, captchaId, captchaAnswer: 'WRONG' } });
    assert.equal(res.status, 400);
    assert.ok(res.data.errors.captcha);
  });

  test('Успішна реєстрація створює неактивований акаунт і надсилає лист активації', async () => {
    const { captchaId } = await captcha();
    const res = await env.api('POST', '/auth/register', { body: { ...newUser, captchaId, captchaAnswer: CAPTCHA_ANSWER } });
    assert.equal(res.status, 201);
    assert.equal(res.data.user.isActivated, false);
    assert.equal(res.data.user.passwordHash, undefined, 'хеш пароля не повертається клієнту');

    const { rows } = await env.db.query('SELECT password_hash FROM users WHERE email = $1', [newUser.email]);
    assert.match(rows[0].password_hash, /^scrypt\$/, 'у БД зберігається лише хеш');
    assert.equal(env.lastLink(newUser.email).pathname, '/activate');
  });

  test('Повторна реєстрація з тією ж поштою — конфлікт (409)', async () => {
    const { captchaId } = await captcha();
    const res = await env.api('POST', '/auth/register', { body: { ...newUser, captchaId, captchaAnswer: CAPTCHA_ANSWER } });
    assert.equal(res.status, 409);
  });

  test('Неактивований користувач входить, але не має доступу до проєктів (403)', async () => {
    const token = await env.login(newUser.email, newUser.password);
    const me = await env.api('GET', '/auth/me', { token });
    assert.equal(me.data.isActivated, false);
    const projects = await env.api('GET', '/projects', { token });
    assert.equal(projects.status, 403);
  });

  test('Посилання з листа активує акаунт; повторно воно не працює', async () => {
    const token = env.lastLink(newUser.email).searchParams.get('token');
    const first = await env.api('POST', '/auth/activate', { body: { token } });
    assert.equal(first.status, 200);
    assert.equal(first.data.user.isActivated, true);
    const second = await env.api('POST', '/auth/activate', { body: { token } });
    assert.equal(second.status, 400);
  });

  test('Вхід з невірним паролем — 401 і запис у журналі входів', async () => {
    const res = await env.api('POST', '/auth/login', { body: { email: newUser.email, password: 'Wrong!Pass1' } });
    assert.equal(res.status, 401);
    assert.equal(res.data.message, 'Невірна пошта або пароль');
  });

  test('Після 5 невдалих спроб акаунт тимчасово блокується (brute force)', async () => {
    let res;
    for (let i = 0; i < 4; i += 1) {
      res = await env.api('POST', '/auth/login', { body: { email: newUser.email, password: `Wrong!Pass${i}` } });
    }
    assert.equal(res.status, 429, '5-та невдала спроба блокує акаунт');
    const withCorrect = await env.api('POST', '/auth/login', { body: { email: newUser.email, password: newUser.password } });
    assert.equal(withCorrect.status, 429, 'під час блокування не допомагає навіть правильний пароль');
    assert.ok(env.mails.some((m) => m.to === newUser.email && m.subject.includes('заблоковано')));
  });

  test('Адміністратор бачить журнал спроб і знімає блокування', async () => {
    const admin = await env.login('olena@example.com');
    const log = await env.api('GET', `/admin/login-attempts?email=${encodeURIComponent(newUser.email)}`, { token: admin });
    assert.equal(log.status, 200);
    assert.ok(log.data.filter((a) => !a.success).length >= 5);
    assert.ok(log.data.some((a) => a.reason === 'wrong_password_locked'));

    const summary = await env.api('GET', '/admin/login-attempts/summary', { token: admin });
    assert.ok(summary.data.find((s) => s.email === newUser.email).failed >= 5);

    const users = await env.api('GET', '/admin/users', { token: admin });
    const user = users.data.find((u) => u.email === newUser.email);
    assert.ok(user.lockedUntil);

    const unlock = await env.api('POST', `/admin/users/${user.id}/unlock`, { token: admin });
    assert.equal(unlock.data.lockedUntil, null);
    await env.login(newUser.email, newUser.password);
  });

  test('RBAC: звичайний користувач не має доступу до адмін-панелі (403)', async () => {
    const token = await env.login('igor@example.com');
    const res = await env.api('GET', '/admin/users', { token });
    assert.equal(res.status, 403);
  });

  test('Заблокований адміністратором користувач не може увійти, а його сеанс завершується', async () => {
    const admin = await env.login('olena@example.com');
    const igorToken = await env.login('igor@example.com');
    const users = await env.api('GET', '/admin/users', { token: admin });
    const igor = users.data.find((u) => u.email === 'igor@example.com');

    await env.api('PATCH', `/admin/users/${igor.id}`, { token: admin, body: { isBlocked: true } });
    assert.equal((await env.api('GET', '/auth/me', { token: igorToken })).status, 401);
    const login = await env.api('POST', '/auth/login', { body: { email: 'igor@example.com', password: 'Password123!' } });
    assert.equal(login.status, 403);

    await env.api('PATCH', `/admin/users/${igor.id}`, { token: admin, body: { isBlocked: false } });
    await env.login('igor@example.com');
  });

  test('2FA: увімкнення через TOTP і вхід у два кроки', async () => {
    let token = await env.login(newUser.email, newUser.password);
    const setup = await env.api('POST', '/profile/2fa/setup', { token });
    assert.match(setup.data.otpauthUri, /^otpauth:\/\/totp\//);

    const bad = await env.api('POST', '/profile/2fa/enable', { token, body: { code: '000000' } });
    assert.equal(bad.status, 400);
    const enable = await env.api('POST', '/profile/2fa/enable', { token, body: { code: generateTotp(setup.data.secret) } });
    assert.equal(enable.data.user.twoFactorEnabled, true);

    const step1 = await env.api('POST', '/auth/login', { body: { email: newUser.email, password: newUser.password } });
    assert.equal(step1.data.twoFactorRequired, true);
    assert.equal(step1.data.token, undefined, 'без коду токен доступу не видається');

    // challenge-токен не можна використати як токен доступу
    assert.equal((await env.api('GET', '/auth/me', { token: step1.data.challengeToken })).status, 401);

    const wrong = await env.api('POST', '/auth/login/2fa', { body: { challengeToken: step1.data.challengeToken, code: '123456' } });
    assert.equal(wrong.status, 401);

    const nextCode = generateTotp(setup.data.secret, Date.now() + 30_000);
    const step2 = await env.api('POST', '/auth/login/2fa', { body: { challengeToken: step1.data.challengeToken, code: nextCode } });
    assert.equal(step2.status, 200);
    token = step2.data.token;

    const replay = await env.api('POST', '/auth/login/2fa', { body: { challengeToken: step1.data.challengeToken, code: nextCode } });
    assert.equal(replay.status, 401, 'той самий код не можна використати повторно');

    const disable = await env.api('POST', '/profile/2fa/disable', {
      token,
      body: { code: generateTotp(setup.data.secret) },
    });
    assert.equal(disable.data.user.twoFactorEnabled, false);
  });

  test('Відновлення пароля через пошту з одноразовим токеном', async () => {
    const unknown = await env.api('POST', '/auth/password/forgot', { body: { email: 'nobody@example.com' } });
    assert.equal(unknown.status, 200, 'відповідь не розкриває, чи існує акаунт');

    const oldToken = await env.login(newUser.email, newUser.password);
    await env.api('POST', '/auth/password/forgot', { body: { email: newUser.email } });
    const link = env.lastLink(newUser.email);
    assert.equal(link.pathname, '/reset-password');
    const token = link.searchParams.get('token');

    assert.equal((await env.api('GET', `/auth/password/reset?token=${token}`)).status, 200);
    const weak = await env.api('POST', '/auth/password/reset', { body: { token, password: 'weak' } });
    assert.equal(weak.status, 400);

    const ok = await env.api('POST', '/auth/password/reset', { body: { token, password: 'N3w!Password' } });
    assert.equal(ok.status, 200);
    assert.equal((await env.api('POST', '/auth/password/reset', { body: { token, password: 'An0ther!Pass' } })).status, 400);
    assert.equal((await env.api('GET', '/auth/me', { token: oldToken })).status, 401, 'старі сеанси завершено');

    await env.login(newUser.email, 'N3w!Password');
  });

  test('Вихід із системи робить токен недійсним', async () => {
    const token = await env.login('maria@example.com');
    assert.equal((await env.api('POST', '/auth/logout', { token })).status, 200);
    assert.equal((await env.api('GET', '/auth/me', { token })).status, 401);
  });

  test('Запит без токена або з підробленим токеном — 401', async () => {
    assert.equal((await env.api('GET', '/auth/me')).status, 401);
    const token = await env.login('maria@example.com');
    const forged = `${token.slice(0, -2)}xx`;
    assert.equal((await env.api('GET', '/auth/me', { token: forged })).status, 401);
  });
});
