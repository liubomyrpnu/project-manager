import { createHmac, timingSafeEqual } from 'node:crypto';

// JSON Web Token з підписом HMAC-SHA256 (RFC 7519, алгоритм HS256).
// Токен складається з трьох частин: заголовок.дані.підпис (base64url).
// Сервер перевіряє підпис секретним ключем і термін дії (exp), тому підробити
// або «продовжити» токен без ключа неможливо.

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

function signature(data, secret) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function signJwt(payload, secret, expiresInSec, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat, exp: iat + expiresInSec })).toString('base64url');
  const data = `${HEADER}.${body}`;
  return `${data}.${signature(data, secret)}`;
}

export class JwtError extends Error {}

export function verifyJwt(token, secret, now = Date.now()) {
  if (typeof token !== 'string') throw new JwtError('Токен відсутній');
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('Некоректний формат токена');
  const [header, body, sig] = parts;
  if (header !== HEADER) throw new JwtError('Непідтримуваний алгоритм');

  const expected = Buffer.from(signature(`${header}.${body}`, secret));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new JwtError('Недійсний підпис токена');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new JwtError('Некоректні дані токена');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(now / 1000)) {
    throw new JwtError('Термін дії токена минув');
  }
  return payload;
}
