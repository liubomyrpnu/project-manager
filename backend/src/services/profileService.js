import { badRequest, throwIfInvalid } from '../errors/AppError.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { passwordPolicyError } from '../security/passwordPolicy.js';
import { buildOtpauthUri, generateTotpSecret, verifyTotp } from '../security/totp.js';
import { validateName } from '../validation/validators.js';
import { toUserDto } from './userDto.js';

const ISSUER = 'ProjectManager';

// Профіль користувача: зміна імені та пароля, керування 2FA (Завдання 5).
export function createProfileService({ users, cryptoBox, issueAccessToken, now = () => new Date() }) {
  const verifyCode = (user, code) => verifyTotp(cryptoBox.decrypt(user.totpSecret), code, { time: now().getTime() });

  return {
    getProfile: (user) => toUserDto(user),

    async updateName(user, { name }) {
      throwIfInvalid({ name: validateName(name) });
      return toUserDto(await users.updateName(user.id, name.trim()));
    },

    // Зміна пароля завершує інші сеанси; поточний отримує новий токен.
    async changePassword(user, { currentPassword, newPassword }) {
      if (user.passwordHash && !(await verifyPassword(currentPassword || '', user.passwordHash))) {
        throw badRequest('Невірний поточний пароль', { currentPassword: 'Невірний поточний пароль' });
      }
      throwIfInvalid({ newPassword: passwordPolicyError(newPassword, { email: user.email }) });
      if (user.passwordHash && currentPassword === newPassword) {
        throw badRequest('Перевірте пароль', { newPassword: 'Новий пароль має відрізнятися від поточного' });
      }
      const updated = await users.updatePassword(user.id, await hashPassword(newPassword));
      return { message: 'Пароль змінено', token: issueAccessToken(updated), user: toUserDto(updated) };
    },

    // Крок 1: генерація секрету й QR-коду. Секрет зберігається зашифрованим, 2FA ще вимкнена.
    async setupTwoFactor(user) {
      if (user.totpEnabled) throw badRequest('Двофакторну автентифікацію вже ввімкнено');
      const secret = generateTotpSecret();
      await users.setTotp(user.id, { secret: cryptoBox.encrypt(secret), enabled: false });
      return { secret, otpauthUri: buildOtpauthUri({ secret, account: user.email, issuer: ISSUER }) };
    },

    // Крок 2: користувач вводить код із застосунку — це підтверджує, що QR відскановано правильно.
    async enableTwoFactor(user, { code }) {
      if (user.totpEnabled) throw badRequest('Двофакторну автентифікацію вже ввімкнено');
      if (!user.totpSecret) throw badRequest('Спочатку згенеруйте QR-код');
      const step = verifyCode(user, code);
      if (step === null) throw badRequest('Невірний код', { code: 'Невірний код з застосунку-автентифікатора' });
      const updated = await users.setTotp(user.id, { secret: user.totpSecret, enabled: true, lastStep: step });
      return { message: 'Двофакторну автентифікацію ввімкнено', user: toUserDto(updated) };
    },

    // Вимкнення 2FA вимагає чинного коду, щоб зловмисник із викраденим сеансом не міг її вимкнути.
    async disableTwoFactor(user, { code }) {
      if (!user.totpEnabled) throw badRequest('Двофакторну автентифікацію не ввімкнено');
      if (verifyCode(user, code) === null) throw badRequest('Невірний код', { code: 'Невірний код з застосунку-автентифікатора' });
      const updated = await users.setTotp(user.id, { secret: null, enabled: false });
      return { message: 'Двофакторну автентифікацію вимкнено', user: toUserDto(updated) };
    },
  };
}
