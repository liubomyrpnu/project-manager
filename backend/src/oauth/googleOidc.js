import { createHash, randomBytes } from 'node:crypto';

// Вхід через Google за протоколом OpenID Connect (Authorization Code Flow + PKCE).
//  1. Сервер перенаправляє браузер на Google з параметрами state, nonce, code_challenge.
//  2. Після згоди користувача Google повертає браузер на /callback з одноразовим code.
//  3. Сервер обмінює code на id_token напряму в Google (з client_secret і code_verifier)
//     та перевіряє в id_token: iss, aud, exp, nonce, email_verified.
// state захищає від CSRF, nonce — від повторного використання id_token,
// PKCE — від перехоплення code.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

const random = () => randomBytes(32).toString('base64url');

export class OidcError extends Error {}

export function createGoogleOidc({ clientId, clientSecret, redirectUri }, { fetchFn = fetch, now = () => Date.now() } = {}) {
  const pending = new Map(); // state -> { nonce, verifier, expiresAt }
  const TTL = 10 * 60 * 1000;

  return {
    isConfigured: () => Boolean(clientId && clientSecret),

    createAuthorizationRequest() {
      const current = now();
      for (const [key, value] of pending) if (value.expiresAt <= current) pending.delete(key);

      const state = random();
      const nonce = random();
      const verifier = random();
      pending.set(state, { nonce, verifier, expiresAt: current + TTL });

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        code_challenge_method: 'S256',
        prompt: 'select_account',
      });
      return { state, url: `${AUTH_URL}?${params}` };
    },

    async handleCallback({ code, state }) {
      const request = pending.get(state);
      pending.delete(state);
      if (!request || request.expiresAt <= now()) throw new OidcError('Сеанс входу через Google застарів. Спробуйте ще раз.');
      if (!code) throw new OidcError('Google не повернув код авторизації');

      const response = await fetchFn(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: request.verifier,
        }),
      });
      if (!response.ok) throw new OidcError('Не вдалося підтвердити вхід через Google');
      const { id_token: idToken } = await response.json();

      // id_token отримано напряму від Google по TLS, тому (OpenID Connect Core, п. 3.1.3.7)
      // достатньо перевірити його вміст; підпис гарантує захищений канал.
      const claims = decodeJwtPayload(idToken);
      if (!ISSUERS.has(claims.iss)) throw new OidcError('Невірний видавець токена');
      if (claims.aud !== clientId) throw new OidcError('Токен призначений іншому застосунку');
      if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now()) throw new OidcError('Термін дії токена минув');
      if (claims.nonce !== request.nonce) throw new OidcError('Невірний nonce');
      if (!claims.email || claims.email_verified !== true) throw new OidcError('Пошта Google не підтверджена');

      return { sub: claims.sub, email: String(claims.email).toLowerCase(), name: claims.name || claims.email };
    },
  };
}

export function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new OidcError('Некоректний id_token');
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new OidcError('Некоректний id_token');
  }
}
