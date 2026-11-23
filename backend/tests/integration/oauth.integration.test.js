import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startTestServer } from '../helpers/testServer.js';

// Вхід через Google (OpenID Connect). Сервер Google імітується функцією fakeGoogle,
// яка повертає id_token з тими самими полями, що й справжній Google.

const toBase64Url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('Вхід через Google (OpenID Connect)', () => {
  let env;
  let profile = { sub: 'google-123', email: 'student.google@gmail.com', name: 'Студент Google' };
  let lastNonce = null;

  const fakeGoogle = async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const params = new URLSearchParams(options.body.toString());
    assert.ok(params.get('code_verifier'), 'PKCE code_verifier передається');
    const claims = {
      iss: 'https://accounts.google.com',
      aud: 'test-client-id',
      exp: Math.floor(Date.now() / 1000) + 300,
      nonce: lastNonce,
      email_verified: true,
      ...profile,
    };
    return { ok: true, json: async () => ({ id_token: `${toBase64Url({ alg: 'RS256' })}.${toBase64Url(claims)}.sig` }) };
  };

  before(async () => {
    env = await startTestServer({ fetchFn: fakeGoogle });
  });
  after(async () => {
    await env?.close();
  });

  // Повний сценарій: /oauth/google → (Google) → /callback → фронтенд → /oauth/exchange
  async function loginThroughGoogle({ cookie = true } = {}) {
    const start = await env.api('GET', '/auth/oauth/google');
    assert.equal(start.status, 302);
    const googleUrl = new URL(start.headers.get('location'));
    assert.equal(googleUrl.hostname, 'accounts.google.com');
    assert.equal(googleUrl.searchParams.get('code_challenge_method'), 'S256');
    const state = googleUrl.searchParams.get('state');
    lastNonce = googleUrl.searchParams.get('nonce');

    const callback = await env.api('GET', `/auth/oauth/google/callback?code=fake-code&state=${state}`, {
      headers: cookie ? { Cookie: `oauth_state=${state}` } : {},
    });
    assert.equal(callback.status, 302);
    return new URL(callback.headers.get('location'));
  }

  test('Провайдер Google позначено як налаштований', async () => {
    assert.deepEqual((await env.api('GET', '/auth/providers')).data, { google: true });
  });

  test('Новий користувач створюється активованим і отримує токен', async () => {
    const redirect = await loginThroughGoogle();
    assert.equal(redirect.pathname, '/oauth/callback');
    const code = redirect.searchParams.get('code');
    const res = await env.api('POST', '/auth/oauth/exchange', { body: { code } });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.email, profile.email);
    assert.equal(res.data.user.isActivated, true);
    assert.equal(res.data.user.googleLinked, true);
    assert.equal(res.data.user.hasPassword, false);

    const again = await env.api('POST', '/auth/oauth/exchange', { body: { code } });
    assert.equal(again.status, 401, 'одноразовий код не працює вдруге');
  });

  test('Наявний акаунт з тією ж поштою прив’язується до Google', async () => {
    profile = { sub: 'google-456', email: 'maria@example.com', name: 'Марія' };
    const redirect = await loginThroughGoogle();
    const res = await env.api('POST', '/auth/oauth/exchange', { body: { code: redirect.searchParams.get('code') } });
    assert.equal(res.data.user.name, 'Марія Шевчук');
    assert.equal(res.data.user.googleLinked, true);
    assert.equal(res.data.user.hasPassword, true);
  });

  test('Без cookie зі state вхід відхиляється (захист від CSRF)', async () => {
    const redirect = await loginThroughGoogle({ cookie: false });
    assert.equal(redirect.searchParams.get('code'), null);
    assert.ok(redirect.searchParams.get('error'));
  });

  test('Вхід через Google записується в журнал входів', async () => {
    const admin = await env.login('olena@example.com');
    const log = await env.api('GET', '/admin/login-attempts', { token: admin });
    assert.ok(log.data.some((a) => a.method === 'google' && a.success));
  });
});
