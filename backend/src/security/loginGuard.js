// Спільні функції для перевірки тимчасового блокування акаунта.
// Правила, коли і на скільки блокувати, винесено в стратегії (lockoutPolicies.js).

export function isTemporarilyLocked(user, now = new Date()) {
  return Boolean(user.lockedUntil && new Date(user.lockedUntil) > now);
}

export function formatLockTime(date) {
  return new Date(date).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
}
