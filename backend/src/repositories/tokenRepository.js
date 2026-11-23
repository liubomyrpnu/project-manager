// Одноразові токени для листів (активація, відновлення пароля).

export function createTokenRepository(db) {
  return {
    create: ({ userId, type, tokenHash, expiresAt }) =>
      db.query(
        `INSERT INTO user_tokens (user_id, type, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
        [userId, type, tokenHash, expiresAt]
      ),

    // Попередні невикористані токени того ж типу стають недійсними.
    invalidateAll: (userId, type) =>
      db.query(
        `UPDATE user_tokens SET used_at = now() WHERE user_id = $1 AND type = $2 AND used_at IS NULL`,
        [userId, type]
      ),

    findValid: async (tokenHash, type) =>
      (
        await db.query(
          `SELECT user_id AS "userId", expires_at AS "expiresAt" FROM user_tokens
           WHERE token_hash = $1 AND type = $2 AND used_at IS NULL AND expires_at > now()`,
          [tokenHash, type]
        )
      ).rows[0] || null,

    // Атомарне «використання» токена одним запитом: повторно використати його неможливо
    // навіть за двох одночасних запитів.
    consume: async (tokenHash, type) =>
      (
        await db.query(
          `UPDATE user_tokens SET used_at = now()
           WHERE token_hash = $1 AND type = $2 AND used_at IS NULL AND expires_at > now()
           RETURNING user_id AS "userId"`,
          [tokenHash, type]
        )
      ).rows[0] || null,
  };
}
