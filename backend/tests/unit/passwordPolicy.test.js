import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { checkPasswordPolicy, passwordStrength } from '../../src/security/passwordPolicy.js';

describe('Політика паролів', () => {
  test('UT-01: пароль, що відповідає всім вимогам, приймається', () => {
    assert.deepEqual(checkPasswordPolicy('Str0ng!Pass'), []);
    assert.deepEqual(checkPasswordPolicy('Пароль#2026'), [], 'кирилиця теж враховується як літери');
  });

  test('UT-02: кожне порушене правило повертається окремим повідомленням', () => {
    assert.deepEqual(checkPasswordPolicy('Ab1!'), ['Щонайменше 8 символів']);
    assert.deepEqual(checkPasswordPolicy('STRONG!PASS1'), ['Мала літера']);
    assert.deepEqual(checkPasswordPolicy('strong!pass1'), ['Велика літера']);
    assert.deepEqual(checkPasswordPolicy('Strong!Pass'), ['Цифра']);
    assert.deepEqual(checkPasswordPolicy('StrongPass1'), ['Символ (не літера і не цифра), наприклад ! @ # %']);
    assert.equal(checkPasswordPolicy('').length, 5);
    assert.equal(checkPasswordPolicy(undefined).length, 5);
  });

  test('UT-03: поширені паролі та паролі з поштою відхиляються', () => {
    assert.ok(checkPasswordPolicy('P@ssw0rd1').some((m) => m.includes('поширений')));
    assert.ok(checkPasswordPolicy('Lubomyr#2026', { email: 'lubomyr@gmail.com' }).some((m) => m.includes('пошту')));
  });

  test('UT-04: сила пароля від 0 до 4', () => {
    assert.equal(passwordStrength(''), 0);
    assert.equal(passwordStrength('abc'), 0);
    assert.equal(passwordStrength('Str0ng!P'), 3);
    assert.equal(passwordStrength('Very-Str0ng-Passphrase'), 4);
  });
});
