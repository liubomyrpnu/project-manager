import { createApp } from './app.js';
import { assertSecrets, loadConfig } from './config.js';
import { createPool } from './db/pool.js';

// Точка входу: читає налаштування, перевіряє підключення до БД і запускає HTTP-сервер.
async function main() {
  const config = loadConfig();
  assertSecrets(config);

  const db = createPool(config.databaseUrl);
  try {
    await db.query('SELECT 1 FROM users LIMIT 1');
  } catch (err) {
    console.error(`Не вдалося підключитися до бази даних: ${err.message}`);
    console.error('Перевірте DATABASE_URL у файлі .env і виконайте: npm run db:reset');
    process.exit(1);
  }

  const { app } = await createApp({ config, db });
  app.listen(config.port, () => {
    console.log(`API запущено: ${config.apiPublicUrl}/api`);
    console.log(`Пошта: ${config.mail.transport === 'smtp' ? `SMTP ${config.mail.smtp.host}` : `консоль + папка ${config.mail.outboxDir}`}`);
    console.log(`Вхід через Google: ${config.google.clientId ? 'налаштовано' : 'не налаштовано'}`);
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
