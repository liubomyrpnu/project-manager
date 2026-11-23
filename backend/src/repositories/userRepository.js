// Репозиторій користувачів: увесь SQL для таблиці users зосереджено тут.
// Усі запити параметризовані ($1, $2 …), тому SQL-ін'єкції неможливі.

const COLUMNS = `
  id, name, email,
  password_hash      AS "passwordHash",
  system_role        AS "systemRole",
  is_blocked         AS "isBlocked",
  is_activated       AS "isActivated",
  failed_login_count AS "failedLoginCount",
  locked_until       AS "lockedUntil",
  totp_secret        AS "totpSecret",
  totp_enabled       AS "totpEnabled",
  totp_last_step::float8 AS "totpLastStep",
  google_sub         AS "googleSub",
  token_version      AS "tokenVersion",
  last_login_at      AS "lastLoginAt",
  created_at         AS "createdAt"`;

export function createUserRepository(db) {
  const one = async (sql, params) => (await db.query(sql, params)).rows[0] || null;

  return {
    findById: (id) => one(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]),

    findByEmail: (email) => one(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [email]),

    findByGoogleSub: (sub) => one(`SELECT ${COLUMNS} FROM users WHERE google_sub = $1`, [sub]),

    create: ({ name, email, passwordHash = null, isActivated = false, googleSub = null, systemRole = 'user' }) =>
      one(
        `INSERT INTO users (name, email, password_hash, is_activated, google_sub, system_role)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
        [name, email, passwordHash, isActivated, googleSub, systemRole]
      ),

    updateName: (id, name) => one(`UPDATE users SET name = $2 WHERE id = $1 RETURNING ${COLUMNS}`, [id, name]),

    // Зміна пароля завершує всі інші сеанси (token_version + 1).
    updatePassword: (id, passwordHash) =>
      one(
        `UPDATE users SET password_hash = $2, token_version = token_version + 1
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, passwordHash]
      ),

    // Відновлення пароля через пошту: новий пароль, зняття тимчасового блокування,
    // підтвердження пошти та завершення всіх сеансів.
    resetPassword: (id, passwordHash) =>
      one(
        `UPDATE users
         SET password_hash = $2, token_version = token_version + 1,
             failed_login_count = 0, locked_until = NULL, is_activated = true
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, passwordHash]
      ),

    activate: (id) => one(`UPDATE users SET is_activated = true WHERE id = $1 RETURNING ${COLUMNS}`, [id]),

    updateLoginState: (id, { failedLoginCount, lockedUntil }) =>
      one(
        `UPDATE users SET failed_login_count = $2, locked_until = $3 WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, failedLoginCount, lockedUntil]
      ),

    recordSuccessfulLogin: (id) =>
      one(
        `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now()
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [id]
      ),

    unlock: (id) =>
      one(`UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1 RETURNING ${COLUMNS}`, [id]),

    setTotp: (id, { secret, enabled, lastStep = null }) =>
      one(
        `UPDATE users SET totp_secret = $2, totp_enabled = $3, totp_last_step = $4 WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, secret, enabled, lastStep]
      ),

    setTotpLastStep: (id, step) => one(`UPDATE users SET totp_last_step = $2 WHERE id = $1 RETURNING id`, [id, step]),

    linkGoogle: (id, googleSub) =>
      one(
        `UPDATE users SET google_sub = $2, is_activated = true WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, googleSub]
      ),

    // Блокування адміністратором одразу завершує всі сеанси користувача.
    setBlocked: (id, isBlocked) =>
      one(
        `UPDATE users SET is_blocked = $2, token_version = token_version + 1 WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, isBlocked]
      ),

    incrementTokenVersion: (id) =>
      one(`UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING ${COLUMNS}`, [id]),

    // Для адміністратора: усі користувачі та кількість невдалих входів за останні 24 години.
    listAll: async () =>
      (
        await db.query(
          `SELECT ${COLUMNS},
                  (SELECT count(*)::int FROM login_attempts a
                   WHERE a.user_id = users.id AND NOT a.success
                     AND a.created_at > now() - interval '24 hours') AS "recentFailures"
           FROM users ORDER BY created_at, name`
        )
      ).rows,
  };
}
