import { resetDatabase } from '../../scripts/dbTools.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { createPool } from '../../src/db/pool.js';
import { memoryTransport } from '../../src/mail/mailService.js';
import { createCaptchaStore } from '../../src/security/captcha.js';

// Тестове середовище для інтеграційних тестів:
// окрема база project_manager_test (перестворюється перед кожним набором тестів),
// пошта в пам'яті та CAPTCHA з відомою відповіддю.
export const CAPTCHA_ANSWER = 'K7M9X';

export function testDatabaseUrl() {
  const config = loadConfig();
  return process.env.TEST_DATABASE_URL || config.databaseUrl.replace(/\/[^/]*$/, '/project_manager_test');
}

export async function startTestServer({ fetchFn } = {}) {
  const databaseUrl = testDatabaseUrl();
  await resetDatabase(databaseUrl);

  const base = loadConfig();
  const config = {
    ...base,
    databaseUrl,
    frontendUrl: 'http://localhost:5173',
    jwtSecret: 'integration-test-secret-integration-test-secret',
    encryptionKey: 'ab'.repeat(32),
    mail: { ...base.mail, transport: 'memory' },
    google: { clientId: 'test-client-id', clientSecret: 'test-client-secret', redirectUri: 'http://localhost:3001/api/auth/oauth/google/callback' },
  };

  const db = createPool(databaseUrl);
  const mail = memoryTransport();
  const store = createCaptchaStore();
  const captcha = { create: () => store.create(CAPTCHA_ANSWER), verify: store.verify };

  const { app } = await createApp({ config, db, mailTransport: mail, fetchFn, captcha, logRequests: false });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  async function api(method, path, { body, rawBody, token, headers = {} } = {}) {
    const response = await fetch(baseUrl + path, {
      method,
      redirect: 'manual',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: response.status, data, headers: response.headers };
  }

  async function login(email, password = 'Password123!') {
    const { status, data } = await api('POST', '/auth/login', { body: { email, password } });
    if (status !== 200) throw new Error(`Вхід ${email} не вдався: ${status} ${JSON.stringify(data)}`);
    return data.token;
  }

  // Посилання з останнього листа, надісланого на адресу.
  function lastLink(to) {
    const message = [...mail.sent].reverse().find((item) => item.to === to);
    const match = message?.text.match(/https?:\/\/\S+/);
    return match ? new URL(match[0]) : null;
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    await db.end();
  }

  return { api, login, lastLink, close, mails: mail.sent, db, config };
}
