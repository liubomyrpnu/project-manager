import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Двофакторна автентифікація TOTP (RFC 6238) — сумісна з Google Authenticator,
// Microsoft Authenticator, Authy. Код = HOTP(секрет, номер 30-секундного інтервалу).

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Base32 (RFC 4648)

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Некоректний символ Base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20)); // 160 біт, як рекомендує RFC 4226
}

// HOTP (RFC 4226): HMAC-SHA1 від лічильника + динамічне скорочення до N цифр.
export function hotp(key, counter, digits = 6) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export const timeStep = (time = Date.now(), period = 30) => Math.floor(time / 1000 / period);

export function generateTotp(secretBase32, time = Date.now(), digits = 6) {
  return hotp(base32Decode(secretBase32), timeStep(time), digits);
}

// Перевіряє код у вікні ±window інтервалів (допуск розсинхронізації годинників).
// Повертає номер інтервалу, якому відповідає код, або null.
// lastUsedStep не дає використати той самий код повторно (replay-атака).
export function verifyTotp(secretBase32, code, { time = Date.now(), window = 1, lastUsedStep = null } = {}) {
  const normalized = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return null;
  const key = base32Decode(secretBase32);
  const current = timeStep(time);
  for (let delta = -window; delta <= window; delta += 1) {
    const step = current + delta;
    if (lastUsedStep !== null && step <= Number(lastUsedStep)) continue;
    const candidate = Buffer.from(hotp(key, step));
    if (timingSafeEqual(candidate, Buffer.from(normalized))) return step;
  }
  return null;
}

// URI для QR-коду, який сканує застосунок-автентифікатор.
export function buildOtpauthUri({ secret, account, issuer }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params}`;
}
