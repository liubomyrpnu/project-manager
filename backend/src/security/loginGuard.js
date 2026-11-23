// Правила захисту від перебору паролів (Завдання 4, brute force).
// Після maxFailedLogins невдалих спроб поспіль акаунт тимчасово блокується
// на lockMinutes хвилин; лічильник обнуляється після успішного входу.

export function isTemporarilyLocked(user, now = new Date()) {
  return Boolean(user.lockedUntil && new Date(user.lockedUntil) > now);
}

// Повертає новий стан лічильника після невдалої спроби.
export function registerFailedAttempt(user, policy, now = new Date()) {
  const failedCount = (user.failedLoginCount || 0) + 1;
  if (failedCount >= policy.maxFailedLogins) {
    return {
      failedLoginCount: 0,
      lockedUntil: new Date(now.getTime() + policy.lockMinutes * 60 * 1000),
      lockedNow: true,
    };
  }
  return { failedLoginCount: failedCount, lockedUntil: null, lockedNow: false };
}

export function formatLockTime(date) {
  return new Date(date).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
}
