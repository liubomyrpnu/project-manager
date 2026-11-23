import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Симетричне шифрування AES-256-GCM для секретів, які потрібно розшифровувати
// (секрет 2FA). Навіть якщо базу даних буде викрадено, без ENCRYPTION_KEY
// секрети 2FA прочитати неможливо. GCM також перевіряє цілісність даних.
// Формат: v1:<iv>:<тег автентифікації>:<шифротекст> (base64)

export function createCryptoBox(hexKey) {
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY має містити 32 байти (64 шістнадцяткові символи)');

  return {
    encrypt(plainText) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
      return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
    },
    decrypt(payload) {
      const [version, iv, tag, data] = String(payload).split(':');
      if (version !== 'v1') throw new Error('Невідомий формат зашифрованих даних');
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
    },
  };
}

// Випадковий одноразовий токен (256 біт) для посилань у листах.
export const generateToken = () => randomBytes(32).toString('base64url');

// У БД зберігається лише SHA-256 хеш токена.
export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');
