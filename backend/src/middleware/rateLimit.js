import { tooManyRequests } from '../errors/AppError.js';

// Обмеження частоти запитів з однієї IP-адреси (фіксоване вікно, у пам'яті сервера).
// Доповнює блокування акаунта: не дає перебирати паролі для багатьох акаунтів одразу,
// масово реєструватися чи надсилати листи.
export function rateLimit({ windowMs, max, message, name = 'default', now = () => Date.now() }) {
  const hits = new Map();

  return (req, res, next) => {
    const current = now();
    const key = `${name}:${req.ip}`;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= current) {
      entry = { count: 0, resetAt: current + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (hits.size > 10_000) {
      for (const [k, value] of hits) if (value.resetAt <= current) hits.delete(k);
    }

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - current) / 1000)));
      return next(tooManyRequests(message || 'Забагато запитів. Спробуйте пізніше.'));
    }
    return next();
  };
}
