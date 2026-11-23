import { badRequest, notFound } from '../errors/AppError.js';
import { isUuid } from '../validation/validators.js';
import { toAdminUserDto } from './userDto.js';

// Функції адміністратора (FR-13, RBAC): список користувачів і їх статус,
// журнал входів, блокування / розблокування облікових записів.
export function createAdminService({ users, attempts, now = () => new Date() }) {
  async function getUser(id) {
    const user = isUuid(id) ? await users.findById(id) : null;
    if (!user) throw notFound('Користувача не знайдено');
    return user;
  }

  return {
    async listUsers() {
      return (await users.listAll()).map((user) => toAdminUserDto(user, now()));
    },

    async setBlocked(admin, userId, { isBlocked }) {
      if (typeof isBlocked !== 'boolean') throw badRequest('Поле isBlocked має бути true або false');
      const user = await getUser(userId);
      if (user.id === admin.id) throw badRequest('Не можна заблокувати власний обліковий запис');
      return toAdminUserDto(await users.setBlocked(user.id, isBlocked), now());
    },

    // Зняття тимчасового блокування після невдалих спроб входу.
    async unlock(userId) {
      const user = await getUser(userId);
      return toAdminUserDto(await users.unlock(user.id), now());
    },

    async listLoginAttempts(query) {
      const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 100, 1), 500);
      const success = query.result === 'success' ? true : query.result === 'failed' ? false : null;
      const email = typeof query.email === 'string' && query.email.trim() ? query.email.trim().slice(0, 255) : null;
      return attempts.list({ email, success, limit });
    },

    async loginSummary(query) {
      const days = Math.min(Math.max(Number.parseInt(query.days, 10) || 7, 1), 365);
      return attempts.summary({ days });
    },
  };
}
