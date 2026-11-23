// Перетворення запису користувача на дані для клієнта.
// Хеш пароля, секрет 2FA та службові поля ніколи не повертаються в API.

export function toUserDto(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    systemRole: user.systemRole,
    isActivated: user.isActivated,
    isBlocked: user.isBlocked,
    twoFactorEnabled: user.totpEnabled,
    hasPassword: Boolean(user.passwordHash),
    googleLinked: Boolean(user.googleSub),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// Розширені дані для адміністратора (FR-13): статус блокування та спроби входу.
export function toAdminUserDto(user, now = new Date()) {
  return {
    ...toUserDto(user),
    failedLoginCount: user.failedLoginCount, // невдалі спроби поспіль (до блокування)
    recentFailures: user.recentFailures ?? 0, // невдалі входи за 24 години
    lockedUntil: user.lockedUntil && new Date(user.lockedUntil) > now ? user.lockedUntil : null,
  };
}
