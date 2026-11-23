import { loadConfig } from '../src/config.js';
import { resetDatabase } from './dbTools.js';
import { SEED_PASSWORD, SEED_USERS } from './seedData.js';

// Створює базу даних (якщо її немає), застосовує схему й додає тестові дані.
// Запуск: npm run db:reset   (psql для цього не потрібен)
const config = loadConfig();

resetDatabase(config.databaseUrl)
  .then(() => {
    console.log('Схему бази даних створено, тестові дані додано.');
    console.log(`Тестові користувачі (пароль ${SEED_PASSWORD}):`);
    for (const user of SEED_USERS) console.log(`  ${user.email.padEnd(22)} ${user.role === 'admin' ? 'адміністратор' : 'користувач'}`);
  })
  .catch((err) => {
    console.error(`Помилка: ${err.message}`);
    process.exit(1);
  });
