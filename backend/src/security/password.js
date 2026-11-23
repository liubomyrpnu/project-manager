import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Хешування паролів алгоритмом scrypt (RFC 7914) з вбудованого модуля crypto.
// scrypt — повільна функція з великими вимогами до пам'яті, тому перебір паролів
// на відеокартах стає дорогим. Для кожного пароля генерується випадкова «сіль»,
// тож однакові паролі мають різні хеші.
// Формат у БД: scrypt$N$r$p$<сіль base64>$<хеш base64>

const scrypt = promisify(scryptCallback);
const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password, salt, KEY_LENGTH, { ...PARAMS, maxmem: MAX_MEMORY });
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

// Автентифікація за рівністю хешів: пароль хешується з тією самою сіллю й
// параметрами, а результат порівнюється за сталий час (захист від timing-атак).
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEMORY,
  });
  return timingSafeEqual(actual, expected);
}

// Хеш для «холостої» перевірки, коли користувача з такою поштою немає:
// час відповіді не підкаже зловмиснику, чи існує акаунт.
let dummyHash = null;
export async function dummyVerify(password) {
  dummyHash ??= await hashPassword('dummy-password-for-timing');
  await verifyPassword(String(password ?? ''), dummyHash);
  return false;
}
