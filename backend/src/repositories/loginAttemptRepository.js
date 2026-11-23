// Журнал спроб входу (для адміністратора).

export function createLoginAttemptRepository(db) {
  return {
    add: ({ userId = null, email, ip = null, userAgent = null, method = 'password', success, reason }) =>
      db.query(
        `INSERT INTO login_attempts (user_id, email, ip, user_agent, method, success, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, String(email || '—').slice(0, 255), ip, userAgent ? String(userAgent).slice(0, 255) : null, method, success, reason]
      ),

    list: async ({ email = null, success = null, limit = 100 } = {}) =>
      (
        await db.query(
          `SELECT a.id::text AS id, a.email, a.ip, a.user_agent AS "userAgent", a.method, a.success, a.reason,
                  a.created_at AS "createdAt", u.name AS "userName"
           FROM login_attempts a
           LEFT JOIN users u ON u.id = a.user_id
           WHERE ($1::text IS NULL OR a.email ILIKE '%' || $1 || '%')
             AND ($2::boolean IS NULL OR a.success = $2)
           ORDER BY a.created_at DESC, a.id DESC
           LIMIT $3`,
          [email, success, limit]
        )
      ).rows,

    // Хто і скільки разів намагався увійти за останні N днів.
    summary: async ({ days = 7 } = {}) =>
      (
        await db.query(
          `SELECT a.email,
                  count(*)::int AS total,
                  count(*) FILTER (WHERE NOT a.success)::int AS failed,
                  count(*) FILTER (WHERE a.success)::int AS succeeded,
                  max(a.created_at) AS "lastAttemptAt",
                  (array_agg(a.ip ORDER BY a.created_at DESC))[1] AS "lastIp",
                  bool_or(u.id IS NOT NULL) AS "accountExists"
           FROM login_attempts a
           LEFT JOIN users u ON u.id = a.user_id
           WHERE a.created_at > now() - make_interval(days => $1::int)
           GROUP BY a.email
           ORDER BY failed DESC, "lastAttemptAt" DESC`,
          [days]
        )
      ).rows,

  };
}
