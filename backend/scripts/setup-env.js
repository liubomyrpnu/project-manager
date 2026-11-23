import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

// Створює файл .env з .env.example і генерує випадкові секрети.
// Запуск: npm run setup   (наявний .env не перезаписується)

const target = new URL('../.env', import.meta.url);
const example = new URL('../.env.example', import.meta.url);

if (fs.existsSync(target)) {
  console.log('Файл .env уже існує — нічого не змінено.');
  process.exit(0);
}

const content = fs
  .readFileSync(example, 'utf8')
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(48).toString('base64url')}`)
  .replace(/^ENCRYPTION_KEY=.*$/m, `ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`);

fs.writeFileSync(target, content, 'utf8');
console.log('Створено файл .env з новими секретами. Перевірте DATABASE_URL (пароль користувача postgres).');
