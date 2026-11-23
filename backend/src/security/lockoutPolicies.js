// Патерн Strategy: політика тимчасового блокування акаунта після невдалих спроб входу.
//
// Раніше правило «5 спроб → 15 хвилин» було жорстко закладене у функції registerFailedAttempt,
// а сервіс автентифікації напряму залежав від неї та від налаштувань maxFailedLogins/lockMinutes.
// Тепер сервіс працює з абстракцією LockoutPolicy, а конкретний алгоритм обирається в конфігурації
// (LOCKOUT_POLICY=fixed | progressive). Нову політику можна додати окремим класом,
// не змінюючи AuthService.

// Абстрактна стратегія (інтерфейс). Метод onFailedAttempt отримує поточний стан користувача
// і повертає новий стан лічильника:
//   { failedLoginCount, lockedUntil, lockedNow, attempts }
//   attempts — кількість невдалих спроб, що призвели до блокування (для повідомлень).
export class LockoutPolicy {
  get name() {
    throw new Error('Політика має визначити name');
  }

  // eslint-disable-next-line no-unused-vars
  onFailedAttempt(user, now) {
    throw new Error('Політика має реалізувати onFailedAttempt');
  }
}

// Стратегія 1 (поточна поведінка системи): після maxFailedLogins невдалих спроб поспіль
// акаунт блокується на фіксований час, лічильник обнуляється.
export class FixedLockoutPolicy extends LockoutPolicy {
  constructor({ maxFailedLogins = 5, lockMinutes = 15 } = {}) {
    super();
    this.maxFailedLogins = maxFailedLogins;
    this.lockMinutes = lockMinutes;
  }

  get name() {
    return 'fixed';
  }

  onFailedAttempt(user, now = new Date()) {
    const failedCount = (user.failedLoginCount || 0) + 1;
    if (failedCount < this.maxFailedLogins) {
      return { failedLoginCount: failedCount, lockedUntil: null, lockedNow: false, attempts: failedCount };
    }
    return {
      failedLoginCount: 0,
      lockedUntil: new Date(now.getTime() + this.lockMinutes * 60 * 1000),
      lockedNow: true,
      attempts: failedCount,
    };
  }
}

// Стратегія 2: прогресивне блокування. Починаючи з threshold-ї невдалої спроби акаунт
// блокується на baseMinutes, і кожна наступна невдала спроба після завершення блокування
// подвоює його тривалість (1, 2, 4, 8 … хв, але не більше maxMinutes).
// Лічильник не обнуляється під час блокування — лише після успішного входу.
// Перевага: випадкова помилка власника блокує його ненадовго, а тривалий перебір
// паролів стає дедалі повільнішим.
export class ProgressiveLockoutPolicy extends LockoutPolicy {
  constructor({ threshold = 3, baseMinutes = 1, maxMinutes = 60 } = {}) {
    super();
    this.threshold = threshold;
    this.baseMinutes = baseMinutes;
    this.maxMinutes = maxMinutes;
  }

  get name() {
    return 'progressive';
  }

  lockMinutesFor(failedCount) {
    return Math.min(this.baseMinutes * 2 ** (failedCount - this.threshold), this.maxMinutes);
  }

  onFailedAttempt(user, now = new Date()) {
    const failedCount = (user.failedLoginCount || 0) + 1;
    if (failedCount < this.threshold) {
      return { failedLoginCount: failedCount, lockedUntil: null, lockedNow: false, attempts: failedCount };
    }
    const minutes = this.lockMinutesFor(failedCount);
    return {
      failedLoginCount: failedCount,
      lockedUntil: new Date(now.getTime() + minutes * 60 * 1000),
      lockedNow: true,
      attempts: failedCount,
    };
  }
}

// Вибір стратегії за назвою з конфігурації. Нова політика реєструється одним рядком у цьому переліку.
const POLICIES = {
  fixed: (security) => new FixedLockoutPolicy({ maxFailedLogins: security.maxFailedLogins, lockMinutes: security.lockMinutes }),
  progressive: () => new ProgressiveLockoutPolicy(),
};

export function createLockoutPolicy(security) {
  const factory = POLICIES[security.lockoutPolicy || 'fixed'];
  if (!factory) {
    throw new Error(`Невідома політика блокування LOCKOUT_POLICY=${security.lockoutPolicy}. Доступні: ${Object.keys(POLICIES).join(', ')}`);
  }
  return factory(security);
}
