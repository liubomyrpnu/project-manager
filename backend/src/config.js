import 'dotenv/config';

// Усі налаштування застосунку читаються зі змінних середовища (файл .env).
// Секрети не зберігаються в коді: їх створює команда `npm run setup`.

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function loadConfig(env = process.env) {
  const port = int(env.PORT, 3001);
  const apiPublicUrl = (env.API_PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');
  const smtpHost = env.SMTP_HOST || '';

  return {
    env: env.NODE_ENV || 'development',
    port,
    apiPublicUrl,
    frontendUrl: (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
    // Кількість проксі перед сервером (наприклад, Nginx для HTTPS); 0 — без проксі.
    trustProxy: int(env.TRUST_PROXY, 0),
    databaseUrl: env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/project_manager',

    jwtSecret: env.JWT_SECRET || '',
    accessTokenTtlSec: int(env.ACCESS_TOKEN_TTL_MIN, 120) * 60,
    encryptionKey: env.ENCRYPTION_KEY || '',

    security: {
      maxFailedLogins: int(env.MAX_FAILED_LOGINS, 5),
      lockMinutes: int(env.LOCK_MINUTES, 15),
      activationTtlHours: int(env.ACTIVATION_TTL_HOURS, 24),
      resetTtlMinutes: int(env.RESET_TTL_MINUTES, 30),
      captchaTtlMinutes: 5,
      twoFactorChallengeMinutes: 5,
    },

    mail: {
      transport: env.MAIL_TRANSPORT || (smtpHost ? 'smtp' : 'console'),
      from: env.MAIL_FROM || 'Project Manager <no-reply@project-manager.local>',
      outboxDir: env.MAIL_OUTBOX_DIR || 'mail-outbox',
      smtp: {
        host: smtpHost,
        port: int(env.SMTP_PORT, 587),
        secure: env.SMTP_SECURE === 'true',
        user: env.SMTP_USER || '',
        pass: env.SMTP_PASS || '',
      },
    },

    google: {
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: `${apiPublicUrl}/api/auth/oauth/google/callback`,
    },
  };
}

// Перевірка обов'язкових секретів під час запуску сервера.
export function assertSecrets(config) {
  const problems = [];
  if (config.jwtSecret.length < 32) problems.push('JWT_SECRET (щонайменше 32 символи)');
  if (!/^[0-9a-f]{64}$/i.test(config.encryptionKey)) problems.push('ENCRYPTION_KEY (64 шістнадцяткові символи)');
  if (problems.length) {
    throw new Error(`У файлі .env не задано: ${problems.join(', ')}. Виконайте команду: npm run setup`);
  }
}
