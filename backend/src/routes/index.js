import { Router } from 'express';
import { requireActivated, requireAuth, requireRole } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const MINUTE = 60 * 1000;

// Маршрути REST API. Префікс /api додається в app.js.
export function createRouter({ controllers, authService, db }) {
  const { auth, profile, admin, projects, tasks } = controllers;
  const router = Router();
  const authenticated = requireAuth(authService);
  const projectAccess = [authenticated, requireActivated];

  // Обмеження частоти запитів з однієї IP-адреси
  const limits = {
    login: rateLimit({ name: 'login', windowMs: 15 * MINUTE, max: 30, message: 'Забагато спроб входу з вашої IP-адреси. Спробуйте через 15 хвилин.' }),
    register: rateLimit({ name: 'register', windowMs: 60 * MINUTE, max: 20, message: 'Забагато реєстрацій з вашої IP-адреси. Спробуйте пізніше.' }),
    captcha: rateLimit({ name: 'captcha', windowMs: 15 * MINUTE, max: 100 }),
    email: rateLimit({ name: 'email', windowMs: 15 * MINUTE, max: 5, message: 'Забагато запитів на надсилання листів. Спробуйте через 15 хвилин.' }),
    token: rateLimit({ name: 'token', windowMs: 15 * MINUTE, max: 30 }),
  };

  router.get('/health', async (req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok', time: new Date().toISOString() });
  });

  // --- Автентифікація (публічні маршрути) ---
  router.get('/auth/captcha', limits.captcha, auth.captcha);
  router.post('/auth/register', limits.register, auth.register);
  router.post('/auth/activate', limits.token, auth.activate);
  router.post('/auth/login', limits.login, auth.login);
  router.post('/auth/login/2fa', limits.login, auth.loginTwoFactor);
  router.post('/auth/password/forgot', limits.email, auth.forgotPassword);
  router.get('/auth/password/reset', limits.token, auth.checkResetToken);
  router.post('/auth/password/reset', limits.token, auth.resetPassword);
  router.get('/auth/providers', auth.providers);
  router.get('/auth/oauth/google', limits.login, auth.googleStart);
  router.get('/auth/oauth/google/callback', auth.googleCallback);
  router.post('/auth/oauth/exchange', limits.login, auth.googleExchange);

  // --- Автентифікований користувач ---
  router.get('/auth/me', authenticated, profile.me);
  router.post('/auth/logout', authenticated, auth.logout);
  router.post('/auth/activation/resend', authenticated, limits.email, auth.resendActivation);

  router.patch('/profile', authenticated, profile.updateName);
  router.post('/profile/password', authenticated, profile.changePassword);
  router.post('/profile/2fa/setup', authenticated, profile.setupTwoFactor);
  router.post('/profile/2fa/enable', authenticated, limits.token, profile.enableTwoFactor);
  router.post('/profile/2fa/disable', authenticated, limits.token, profile.disableTwoFactor);

  // --- Адміністратор (RBAC: роль admin) ---
  const adminOnly = [authenticated, requireRole('admin')];
  router.get('/admin/users', adminOnly, admin.listUsers);
  router.patch('/admin/users/:id', adminOnly, admin.setBlocked);
  router.post('/admin/users/:id/unlock', adminOnly, admin.unlock);
  router.get('/admin/login-attempts', adminOnly, admin.loginAttempts);
  router.get('/admin/login-attempts/summary', adminOnly, admin.loginSummary);

  // --- Проєкти, учасники, завдання (лише активовані акаунти) ---
  router.get('/projects', projectAccess, projects.list);
  router.post('/projects', projectAccess, projects.create);
  router.get('/projects/:id', projectAccess, projects.get);
  router.put('/projects/:id', projectAccess, projects.update);
  router.delete('/projects/:id', projectAccess, projects.remove);
  router.get('/projects/:id/members', projectAccess, projects.listMembers);
  router.post('/projects/:id/members', projectAccess, projects.addMember);
  router.delete('/projects/:id/members/:userId', projectAccess, projects.removeMember);
  router.get('/projects/:id/tasks', projectAccess, projects.listTasks);
  router.post('/projects/:id/tasks', projectAccess, projects.createTask);

  router.get('/tasks/my', projectAccess, tasks.mine);
  router.put('/tasks/:id', projectAccess, tasks.update);
  router.patch('/tasks/:id', projectAccess, tasks.changeStatus);
  router.delete('/tasks/:id', projectAccess, tasks.remove);

  return router;
}
