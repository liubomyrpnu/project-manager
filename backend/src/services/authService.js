import { badRequest, conflict, forbidden, throwIfInvalid, tooManyRequests, unauthorized } from '../errors/AppError.js';
import { SecurityEvents } from '../events/SecurityEventPublisher.js';
import { activationEmail, passwordResetEmail } from '../mail/templates.js';
import { generateToken, hashToken } from '../security/cryptoBox.js';
import { signJwt, verifyJwt } from '../security/jwt.js';
import { formatLockTime, isTemporarilyLocked } from '../security/loginGuard.js';
import { dummyVerify, hashPassword, verifyPassword } from '../security/password.js';
import { passwordPolicyError } from '../security/passwordPolicy.js';
import { verifyTotp } from '../security/totp.js';
import { normalizeEmail, validateEmail, validateName } from '../validation/validators.js';
import { toUserDto } from './userDto.js';

const INVALID_CREDENTIALS = 'Невірна пошта або пароль';

// Сервіс автентифікації: реєстрація, активація, вхід (з 2FA), вихід,
// відновлення пароля та захист від перебору паролів.
//   events        — видавець подій безпеки (патерн Observer): журнал входів, лист про блокування тощо;
//   lockoutPolicy — стратегія тимчасового блокування акаунта (патерн Strategy).
export function createAuthService({ users, tokens, events, lockoutPolicy, mail, captcha, cryptoBox, config, now = () => new Date() }) {
  const { security } = config;

  // ---------- Токени доступу ----------
  const issueAccessToken = (user) =>
    signJwt({ sub: user.id, tv: user.tokenVersion, purpose: 'access' }, config.jwtSecret, config.accessTokenTtlSec, now().getTime());

  const issueTwoFactorChallenge = (user) =>
    signJwt(
      { sub: user.id, tv: user.tokenVersion, purpose: '2fa' },
      config.jwtSecret,
      security.twoFactorChallengeMinutes * 60,
      now().getTime()
    );

  // Перевірка токена доступу на кожному запиті (використовує middleware requireAuth).
  async function authenticate(token) {
    let payload;
    try {
      payload = verifyJwt(token, config.jwtSecret, now().getTime());
    } catch {
      throw unauthorized('Сеанс недійсний або завершився. Увійдіть знову.');
    }
    if (payload.purpose !== 'access') throw unauthorized('Недійсний токен доступу');
    const user = await users.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) throw unauthorized('Сеанс завершено. Увійдіть знову.');
    if (user.isBlocked) throw forbidden('Обліковий запис заблоковано адміністратором');
    return user;
  }

  // ---------- Події входу (Observer) ----------
  // Сервіс лише повідомляє, що сталося; запис у журнал і листи виконують спостерігачі.
  const loginSucceeded = (user, ctx, method) =>
    events.notify(SecurityEvents.LOGIN_SUCCEEDED, { user, method, reason: 'ok', context: ctx });

  const loginFailed = (user, email, ctx, method, reason) =>
    events.notify(SecurityEvents.LOGIN_FAILED, { user, email, method, reason, context: ctx });

  async function sendSafely(to, message) {
    try {
      await mail.send({ to, ...message });
      return true;
    } catch (err) {
      console.error('[mail] помилка надсилання:', err.message);
      return false;
    }
  }

  // Фіксує невдалу спробу; чи блокувати акаунт і на скільки — вирішує стратегія lockoutPolicy.
  async function failAttempt(user, ctx, { method, reason, message }) {
    const state = lockoutPolicy.onFailedAttempt(user, now());
    await users.updateLoginState(user.id, { failedLoginCount: state.failedLoginCount, lockedUntil: state.lockedUntil });
    await loginFailed(user, user.email, ctx, method, state.lockedNow ? `${reason}_locked` : reason);
    if (state.lockedNow) {
      await events.notify(SecurityEvents.ACCOUNT_LOCKED, {
        user,
        lockedUntil: state.lockedUntil,
        attempts: state.attempts,
        context: ctx,
      });
      throw tooManyRequests(
        `Забагато невдалих спроб (${state.attempts}). Обліковий запис тимчасово заблоковано до ${formatLockTime(state.lockedUntil)}.`
      );
    }
    throw unauthorized(message);
  }

  async function assertCanLogin(user, ctx, method) {
    if (user.isBlocked) {
      await loginFailed(user, user.email, ctx, method, 'blocked');
      throw forbidden('Обліковий запис заблоковано адміністратором');
    }
    if (isTemporarilyLocked(user, now())) {
      await loginFailed(user, user.email, ctx, method, 'locked');
      throw tooManyRequests(
        `Обліковий запис тимчасово заблоковано через невдалі спроби входу. Спробуйте після ${formatLockTime(user.lockedUntil)}.`
      );
    }
  }

  // Завершення входу: якщо ввімкнено 2FA — повертається тимчасовий токен-«виклик»,
  // інакше — токен доступу.
  async function completeLogin(user, ctx, method) {
    if (user.totpEnabled) {
      return { twoFactorRequired: true, challengeToken: issueTwoFactorChallenge(user) };
    }
    const updated = await users.recordSuccessfulLogin(user.id);
    await loginSucceeded(updated, ctx, method);
    return { token: issueAccessToken(updated), user: toUserDto(updated) };
  }

  async function createEmailToken(user, type, ttlMs) {
    await tokens.invalidateAll(user.id, type);
    const token = generateToken();
    await tokens.create({ userId: user.id, type, tokenHash: hashToken(token), expiresAt: new Date(now().getTime() + ttlMs) });
    return token;
  }

  async function sendActivation(user) {
    const token = await createEmailToken(user, 'activation', security.activationTtlHours * 3600 * 1000);
    const url = `${config.frontendUrl}/activate?token=${encodeURIComponent(token)}`;
    return sendSafely(user.email, activationEmail({ name: user.name, url, hours: security.activationTtlHours }));
  }

  return {
    authenticate,
    issueAccessToken,
    completeLogin,
    assertCanLogin,

    createCaptcha: () => captcha.create(),

    // ---------- Завдання 1-3: реєстрація з політикою пароля, CAPTCHA, лист активації ----------
    async register(body) {
      const { name, email, password, captchaId, captchaAnswer } = body;
      const normalized = normalizeEmail(email);
      throwIfInvalid({
        name: validateName(name),
        email: validateEmail(email),
        password: passwordPolicyError(password, { email: normalized }),
        captcha: captchaAnswer ? '' : 'Введіть символи з картинки',
      });
      // CAPTCHA перевіряється до звернення до БД, щоб бот не міг перебирати пошти.
      if (!captcha.verify(captchaId, captchaAnswer)) {
        throw badRequest('CAPTCHA не пройдено', { captcha: 'Невірні символи з картинки або термін дії минув. Спробуйте ще раз.' });
      }
      if (await users.findByEmail(normalized)) throw conflict('Користувач з такою поштою вже існує');

      const user = await users.create({ name: name.trim(), email: normalized, passwordHash: await hashPassword(password) });
      const sent = await sendActivation(user);
      return {
        message: sent
          ? `Акаунт створено. Ми надіслали лист для активації на ${normalized}.`
          : 'Акаунт створено, але лист не вдалося надіслати. Увійдіть і повторіть надсилання у профілі.',
        user: toUserDto(user),
      };
    },

    async activate({ token }) {
      if (!token || typeof token !== 'string') throw badRequest('Посилання для активації недійсне');
      const record = await tokens.consume(hashToken(token), 'activation');
      if (!record) throw badRequest('Посилання недійсне, уже використане або термін його дії минув');
      const user = await users.activate(record.userId);
      return { message: 'Обліковий запис активовано. Тепер ви маєте повний доступ до системи.', user: toUserDto(user) };
    },

    async resendActivation(user) {
      if (user.isActivated) throw badRequest('Обліковий запис уже активовано');
      const sent = await sendActivation(user);
      if (!sent) throw badRequest('Не вдалося надіслати лист. Спробуйте пізніше.');
      return { message: `Новий лист для активації надіслано на ${user.email}` };
    },

    // ---------- Вхід + Завдання 4 (brute force) ----------
    async login({ email, password }, ctx) {
      const normalized = normalizeEmail(email);
      throwIfInvalid({
        email: validateEmail(email),
        password: password ? '' : 'Введіть пароль',
      });

      const user = await users.findByEmail(normalized);
      if (!user) {
        await dummyVerify(password); // однаковий час відповіді для існуючих і неіснуючих акаунтів
        await loginFailed(null, normalized, ctx, 'password', 'unknown_email');
        throw unauthorized(INVALID_CREDENTIALS);
      }

      if (isTemporarilyLocked(user, now())) await assertCanLogin(user, ctx, 'password');

      const valid = user.passwordHash ? await verifyPassword(password, user.passwordHash) : await dummyVerify(password);
      if (!valid) {
        await failAttempt(user, ctx, {
          method: 'password',
          reason: user.passwordHash ? 'wrong_password' : 'no_password',
          message: INVALID_CREDENTIALS,
        });
      }
      await assertCanLogin(user, ctx, 'password');
      return completeLogin(user, ctx, 'password');
    },

    // ---------- Завдання 5: другий крок входу з кодом TOTP ----------
    async loginWithTwoFactor({ challengeToken, code }, ctx) {
      let payload;
      try {
        payload = verifyJwt(challengeToken, config.jwtSecret, now().getTime());
      } catch {
        throw unauthorized('Час на введення коду минув. Увійдіть знову.');
      }
      if (payload.purpose !== '2fa') throw unauthorized('Недійсний запит підтвердження');

      const user = await users.findById(payload.sub);
      if (!user || user.tokenVersion !== payload.tv || !user.totpEnabled) throw unauthorized('Увійдіть знову');
      await assertCanLogin(user, ctx, '2fa');

      const step = verifyTotp(cryptoBox.decrypt(user.totpSecret), code, {
        time: now().getTime(),
        lastUsedStep: user.totpLastStep,
      });
      if (step === null) {
        await failAttempt(user, ctx, { method: '2fa', reason: 'wrong_2fa_code', message: 'Невірний або вже використаний код підтвердження' });
      }
      await users.setTotpLastStep(user.id, step);
      const updated = await users.recordSuccessfulLogin(user.id);
      await loginSucceeded(updated, ctx, '2fa');
      return { token: issueAccessToken(updated), user: toUserDto(updated) };
    },

    // Вихід: token_version + 1, тож усі видані раніше токени стають недійсними.
    async logout(user) {
      await users.incrementTokenVersion(user.id);
      return { message: 'Ви вийшли з системи' };
    },

    // ---------- Завдання 7: відновлення пароля ----------
    async requestPasswordReset({ email }) {
      throwIfInvalid({ email: validateEmail(email) });
      const user = await users.findByEmail(normalizeEmail(email));
      // Відповідь однакова незалежно від існування акаунта (без розкриття користувачів).
      if (user && !user.isBlocked) {
        const token = await createEmailToken(user, 'password_reset', security.resetTtlMinutes * 60 * 1000);
        const url = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
        await sendSafely(user.email, passwordResetEmail({ name: user.name, url, minutes: security.resetTtlMinutes }));
      }
      return { message: 'Якщо акаунт із такою поштою існує, ми надіслали на неї лист з інструкціями.' };
    },

    async checkResetToken({ token }) {
      const record = token ? await tokens.findValid(hashToken(token), 'password_reset') : null;
      if (!record) throw badRequest('Посилання недійсне, уже використане або термін його дії минув');
      return { valid: true, expiresAt: record.expiresAt };
    },

    async resetPassword({ token, password }) {
      const tokenHash = hashToken(token || '');
      const record = token ? await tokens.findValid(tokenHash, 'password_reset') : null;
      if (!record) throw badRequest('Посилання недійсне, уже використане або термін його дії минув');

      const user = await users.findById(record.userId);
      throwIfInvalid({ password: passwordPolicyError(password, { email: user.email }) });
      if (user.passwordHash && (await verifyPassword(password, user.passwordHash))) {
        throw badRequest('Перевірте пароль', { password: 'Новий пароль має відрізнятися від попереднього' });
      }

      const consumed = await tokens.consume(tokenHash, 'password_reset');
      if (!consumed) throw badRequest('Посилання вже використане');
      await users.resetPassword(user.id, await hashPassword(password));
      return { message: 'Пароль змінено. Тепер увійдіть з новим паролем.' };
    },
  };
}
