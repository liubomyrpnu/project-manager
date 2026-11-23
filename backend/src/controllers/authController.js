import { clientContext } from '../middleware/auth.js';

const OAUTH_COOKIE = 'oauth_state';

const readCookie = (req, name) =>
  (req.get('cookie') || '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1];

// Контролер автентифікації: приймає HTTP-запит, викликає сервіс, формує відповідь.
export function createAuthController({ authService, oauthService, config }) {
  const body = (req) => req.body ?? {};

  return {
    captcha(req, res) {
      res.set('Cache-Control', 'no-store');
      res.json(authService.createCaptcha());
    },

    async register(req, res) {
      res.status(201).json(await authService.register(body(req)));
    },

    async activate(req, res) {
      res.json(await authService.activate(body(req)));
    },

    async resendActivation(req, res) {
      res.json(await authService.resendActivation(req.user));
    },

    async login(req, res) {
      res.json(await authService.login(body(req), clientContext(req)));
    },

    async loginTwoFactor(req, res) {
      res.json(await authService.loginWithTwoFactor(body(req), clientContext(req)));
    },

    async logout(req, res) {
      res.json(await authService.logout(req.user));
    },

    async forgotPassword(req, res) {
      res.json(await authService.requestPasswordReset(body(req)));
    },

    async checkResetToken(req, res) {
      res.json(await authService.checkResetToken({ token: req.query.token }));
    },

    async resetPassword(req, res) {
      res.json(await authService.resetPassword(body(req)));
    },

    providers(req, res) {
      res.json({ google: oauthService.isConfigured() });
    },

    // Перенаправлення на сторінку входу Google. state дублюється в cookie,
    // щоб callback прийняв лише той браузер, який почав вхід (захист від login CSRF).
    googleStart(req, res) {
      const { url, state } = oauthService.start();
      res.cookie(OAUTH_COOKIE, state, { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/api/auth/oauth' });
      res.redirect(url);
    },

    async googleCallback(req, res) {
      const target = new URL('/oauth/callback', config.frontendUrl);
      try {
        if (!req.query.state || readCookie(req, OAUTH_COOKIE) !== req.query.state) {
          throw new Error('Сеанс входу через Google недійсний. Спробуйте ще раз.');
        }
        const code = await oauthService.handleCallback(req.query);
        target.searchParams.set('code', code);
      } catch (err) {
        target.searchParams.set('error', err.message || 'Не вдалося увійти через Google');
      }
      res.clearCookie(OAUTH_COOKIE, { path: '/api/auth/oauth' });
      res.redirect(target.toString());
    },

    async googleExchange(req, res) {
      res.json(await oauthService.exchange(body(req), clientContext(req)));
    },
  };
}
