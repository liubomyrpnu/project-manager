import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

// Власна CAPTCHA (Завдання 2): сервер малює SVG-зображення з 5 символів.
// Символи намальовані лініями (path), а не текстом, тому бот не може просто
// прочитати їх із коду SVG. Кожен символ випадково повернутий, зміщений і
// спотворений, поверх додано шумові криві. Відповідь зберігається на сервері
// лише у вигляді хешу, діє 5 хвилин і може бути перевірена тільки один раз.

// Векторні «гліфи» на сітці 10×14 (ламані лінії). Схожі символи (0/O, 1/I, B/8, S/5, A/4) не використовуються.
const GLYPHS = {
  2: [[0, 3, 2, 0, 8, 0, 10, 3, 10, 5, 0, 14, 10, 14]],
  3: [[0, 1, 3, 0, 8, 0, 10, 2, 10, 5, 7, 7, 3, 7], [7, 7, 10, 9, 10, 12, 8, 14, 3, 14, 0, 13]],
  6: [[9, 1, 6, 0, 3, 0, 0, 4, 0, 11, 3, 14, 7, 14, 10, 11, 10, 8, 7, 6, 3, 6, 0, 8]],
  7: [[0, 0, 10, 0, 4, 14]],
  8: [[5, 7, 1, 5, 1, 2, 3, 0, 7, 0, 9, 2, 9, 5, 5, 7, 0, 9, 0, 12, 2, 14, 8, 14, 10, 12, 10, 9, 5, 7]],
  9: [[10, 6, 7, 8, 3, 8, 0, 6, 0, 3, 3, 0, 7, 0, 10, 3, 10, 10, 7, 14, 3, 14, 1, 13]],
  C: [[10, 2, 8, 0, 3, 0, 0, 3, 0, 11, 3, 14, 8, 14, 10, 12]],
  E: [[10, 0, 0, 0, 0, 14, 10, 14], [0, 7, 7, 7]],
  F: [[10, 0, 0, 0, 0, 14], [0, 7, 7, 7]],
  H: [[0, 0, 0, 14], [10, 0, 10, 14], [0, 7, 10, 7]],
  K: [[0, 0, 0, 14], [10, 0, 0, 8], [3, 6, 10, 14]],
  M: [[0, 14, 0, 0, 5, 8, 10, 0, 10, 14]],
  N: [[0, 14, 0, 0, 10, 14, 10, 0]],
  P: [[0, 14, 0, 0, 7, 0, 10, 2, 10, 5, 7, 7, 0, 7]],
  R: [[0, 14, 0, 0, 7, 0, 10, 2, 10, 5, 7, 7, 0, 7], [5, 7, 10, 14]],
  T: [[0, 0, 10, 0], [5, 0, 5, 14]],
  U: [[0, 0, 0, 11, 3, 14, 7, 14, 10, 11, 10, 0]],
  W: [[0, 0, 2, 14, 5, 6, 8, 14, 10, 0]],
  X: [[0, 0, 10, 14], [10, 0, 0, 14]],
  Y: [[0, 0, 5, 7, 10, 0], [5, 7, 5, 14]],
};
export const CAPTCHA_ALPHABET = Object.keys(GLYPHS).join('');

const WIDTH = 220;
const PADDING = 16;
const HEIGHT = 70;
const rand = (min, max) => min + (randomInt(0, 10_000) / 10_000) * (max - min);
const fixed = (n) => n.toFixed(1);

function randomColor(dark) {
  const base = dark ? [20, 110] : [150, 230];
  return `rgb(${randomInt(...base)},${randomInt(...base)},${randomInt(...base)})`;
}

function drawChar(char, index, count) {
  const scale = rand(2.5, 3);
  const angle = (rand(-15, 15) * Math.PI) / 180;
  const skew = rand(-0.2, 0.2);
  const color = randomColor(true);
  const cx = PADDING + ((index + 0.5) * (WIDTH - 2 * PADDING)) / count + rand(-4, 4);
  const cy = HEIGHT / 2 + rand(-6, 6);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const transform = (gx, gy) => {
    // зміщення до центру гліфа, нахил, масштаб, поворот, шум кожної точки
    const x = (gx - 5 + (gy - 7) * skew + rand(-0.6, 0.6)) * scale;
    const y = (gy - 7 + rand(-0.6, 0.6)) * scale;
    return [cx + x * cos - y * sin, cy + x * sin + y * cos];
  };

  return GLYPHS[char]
    .map((line) => {
      const points = [];
      for (let i = 0; i < line.length; i += 2) points.push(transform(line[i], line[i + 1]).map(fixed).join(' '));
      return `<path d="M${points.join(' L')}" stroke="${color}" stroke-width="${fixed(rand(2.8, 3.6))}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
}

function noiseCurve() {
  const p = () => `${fixed(rand(0, WIDTH))} ${fixed(rand(0, HEIGHT))}`;
  return `<path d="M${fixed(rand(-10, 20))} ${fixed(rand(0, HEIGHT))} C${p()} ${p()} ${fixed(rand(WIDTH - 20, WIDTH + 10))} ${fixed(rand(0, HEIGHT))}" stroke="${randomColor(true)}" stroke-width="${fixed(rand(1.2, 2.4))}" fill="none" opacity="0.8"/>`;
}

export function renderCaptcha(text) {
  if (![...text].every((char) => GLYPHS[char])) throw new Error(`CAPTCHA підтримує лише символи ${CAPTCHA_ALPHABET}`);
  const dots = Array.from({ length: 40 }, () =>
    `<circle cx="${fixed(rand(0, WIDTH))}" cy="${fixed(rand(0, HEIGHT))}" r="${fixed(rand(0.6, 1.8))}" fill="${randomColor(false)}"/>`
  ).join('');
  const chars = [...text].map((char, i) => drawChar(char, i, text.length)).join('');
  const noise = Array.from({ length: randomInt(4, 7) }, noiseCurve).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><rect width="100%" height="100%" fill="${randomColor(false)}"/>${dots}${chars}${noise}</svg>`;
}

export function randomCaptchaText(length = 5) {
  return Array.from({ length }, () => CAPTCHA_ALPHABET[randomInt(0, CAPTCHA_ALPHABET.length)]).join('');
}

const digest = (value) => createHash('sha256').update(String(value).trim().toUpperCase()).digest();

// Сховище виданих CAPTCHA у пам'яті сервера.
export function createCaptchaStore({ ttlMs = 5 * 60 * 1000, maxSize = 10_000, now = () => Date.now() } = {}) {
  const items = new Map();

  const cleanup = () => {
    const current = now();
    for (const [id, item] of items) if (item.expiresAt <= current) items.delete(id);
  };

  return {
    create(text = randomCaptchaText()) {
      cleanup();
      if (items.size >= maxSize) items.delete(items.keys().next().value);
      const id = randomUUID();
      items.set(id, { hash: digest(text), expiresAt: now() + ttlMs });
      return { captchaId: id, svg: renderCaptcha(text) };
    },
    // Одноразова перевірка: після будь-якої спроби CAPTCHA видаляється.
    verify(id, answer) {
      const item = items.get(id);
      items.delete(id);
      if (!item || item.expiresAt <= now() || typeof answer !== 'string' || !answer.trim()) return false;
      return timingSafeEqual(item.hash, digest(answer));
    },
    get size() {
      return items.size;
    },
  };
}
