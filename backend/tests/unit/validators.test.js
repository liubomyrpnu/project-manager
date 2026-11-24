import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  getDeadlineState,
  isUuid,
  isEmailFormat,
  isValidDateString,
  normalizeEmail,
  validateEmail,
  validateText,
} from '../../src/validation/validators.js';

describe('Валідація вхідних даних', () => {
  test('UT-13: пошта нормалізується та перевіряється за форматом', () => {
    assert.equal(normalizeEmail('  Ivan@Example.COM '), 'ivan@example.com');
    assert.equal(validateEmail('ivan@example.com'), '');
    assert.equal(validateEmail(''), 'Введіть електронну пошту');
    assert.equal(validateEmail('ivan@'), 'Некоректний формат пошти');
    assert.equal(validateEmail(`${'a'.repeat(250)}@x.com`), 'Некоректний формат пошти');
  });

  test('UT-14: дата дедлайну має існувати в календарі', () => {
    assert.equal(isValidDateString('2026-12-31'), true);
    assert.equal(isValidDateString('2028-02-29'), true);
    assert.equal(isValidDateString('2026-02-29'), false);
    assert.equal(isValidDateString('31.12.2026'), false);
  });

  test('UT-15: довжина текстових полів і UUID', () => {
    assert.equal(validateText('AB', { label: 'Назва', min: 3 }), 'Поле «Назва» має містити щонайменше 3 символи');
    assert.equal(validateText('   ', { label: 'Опис', required: false }), '');
    assert.equal(validateText(42, { label: 'Назва' }), 'Поле «Назва» має бути текстом');
    assert.equal(isUuid('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
    assert.equal(isUuid("1' OR '1'='1"), false);
  });

  test('UT-16: стан дедлайну завдання (FR-12)', () => {
    const today = new Date(2026, 10, 23);
    assert.equal(getDeadlineState('2026-11-22', 'todo', today), 'overdue');
    assert.equal(getDeadlineState('2026-11-26', 'in_progress', today), 'soon');
    assert.equal(getDeadlineState('2026-11-27', 'todo', today), 'ok');
    assert.equal(getDeadlineState('2026-11-01', 'done', today), 'none');
    assert.equal(getDeadlineState(null, 'todo', today), 'none');
  });

  test('UT-31: перевірка пошти працює за лінійний час (захист від ReDoS, SonarQube S5852)', () => {
    assert.equal(isEmailFormat('ivan@mail.example.com'), true);
    assert.equal(isEmailFormat('ivan@localhost'), false);
    assert.equal(isEmailFormat('ivan@@example.com'), false);
    assert.equal(isEmailFormat('@example.com'), false);
    assert.equal(isEmailFormat('ivan@example..com'), false);

    // Рядок, на якому старий вираз /^[^\s@]+@[^\s@]+\.[^\s@]+$/ має квадратичну складність:
    // 40 000 символів — близько 2,7 с роботи, весь цей час сервер Node.js заблокований
    const attack = `a@${'.'.repeat(40_000)}@`;
    const started = performance.now();
    assert.equal(isEmailFormat(attack), false);
    assert.ok(performance.now() - started < 50, 'перевірка має тривати мілісекунди');
  });
});
