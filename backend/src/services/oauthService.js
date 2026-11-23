import { randomBytes } from 'node:crypto';
import { serviceUnavailable, unauthorized } from '../errors/AppError.js';

// Завдання 6: вхід через Google (OpenID Connect).
// Після успішного входу браузер повертається на фронтенд з одноразовим кодом (60 с),
// який фронтенд обмінює на токен доступу. Сам токен в адресі не передається.
export function createOAuthService({ google, users, authService, now = () => Date.now() }) {
  const loginCodes = new Map(); // code -> { userId, expiresAt }

  const ensureConfigured = () => {
    if (!google.isConfigured()) {
      throw serviceUnavailable('Вхід через Google не налаштовано: задайте GOOGLE_CLIENT_ID і GOOGLE_CLIENT_SECRET у .env');
    }
  };

  // Пошук користувача за Google ID, потім за поштою (прив'язка), інакше — створення нового.
  async function findOrCreateUser(profile) {
    const bySub = await users.findByGoogleSub(profile.sub);
    if (bySub) return bySub;
    const byEmail = await users.findByEmail(profile.email);
    if (byEmail) return users.linkGoogle(byEmail.id, profile.sub);
    return users.create({
      name: String(profile.name).slice(0, 100),
      email: profile.email,
      passwordHash: null,
      isActivated: true, // Google уже підтвердив пошту
      googleSub: profile.sub,
    });
  }

  return {
    isConfigured: () => google.isConfigured(),

    start() {
      ensureConfigured();
      return google.createAuthorizationRequest();
    },

    async handleCallback(query) {
      ensureConfigured();
      if (query.error) throw unauthorized('Вхід через Google скасовано');
      const profile = await google.handleCallback({ code: query.code, state: query.state });
      const user = await findOrCreateUser(profile);

      const current = now();
      for (const [key, value] of loginCodes) if (value.expiresAt <= current) loginCodes.delete(key);
      const code = randomBytes(32).toString('base64url');
      loginCodes.set(code, { userId: user.id, expiresAt: current + 60_000 });
      return code;
    },

    async exchange({ code }, ctx) {
      const entry = loginCodes.get(code);
      loginCodes.delete(code);
      if (!entry || entry.expiresAt <= now()) throw unauthorized('Код входу недійсний або застарів. Спробуйте ще раз.');
      const user = await users.findById(entry.userId);
      if (!user) throw unauthorized('Користувача не знайдено');
      await authService.assertCanLogin(user, ctx, 'google');
      return authService.completeLogin(user, ctx, 'google');
    },
  };
}
