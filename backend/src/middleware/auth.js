import { forbidden, unauthorized } from '../errors/AppError.js';

// Автентифікація: перевіряє заголовок Authorization: Bearer <токен>
// і додає до запиту поточного користувача (req.user).
export function requireAuth(authService) {
  return async (req, res, next) => {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(unauthorized());
    req.user = await authService.authenticate(token);
    return next();
  };
}

// Авторизація за системною роллю (RBAC): наприклад, requireRole('admin').
export function requireRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.user?.systemRole) ? next() : next(forbidden('Недостатньо прав для цієї дії'));
}

// Робота з проєктами доступна лише після активації акаунта через пошту.
export function requireActivated(req, res, next) {
  return req.user?.isActivated
    ? next()
    : next(forbidden('Активуйте обліковий запис за посиланням з листа, щоб працювати з проєктами'));
}

// IP та браузер клієнта для журналу входів.
export const clientContext = (req) => ({
  ip: req.ip?.replace(/^::ffff:/, '') || null, // IPv4-адреса без IPv6-префікса
  userAgent: req.get('user-agent') || null,
});
