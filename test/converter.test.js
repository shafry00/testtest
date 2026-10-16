'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  convert,
  parseApiResponse,
  formatMoney,
  formatRate,
  currencyName
} = require('../src/converter.js');

// Bentuk respons sama dengan https://open.er-api.com/v6/latest/USD
const sample = {
  result: 'success',
  base_code: 'USD',
  time_last_update_unix: 1760486551,
  time_next_update_unix: 1760574701,
  rates: { USD: 1, IDR: 17907.815096, EUR: 0.894425, JPY: 158.305497 }
};

test('convert mengalikan jumlah dengan kurs', () => {
  assert.equal(convert(2, 17907.5), 35815);
  assert.equal(convert(0, 17907.5), 0);
});

test('convert mengembalikan NaN untuk input tidak valid', () => {
  assert.ok(Number.isNaN(convert(NaN, 1)));
  assert.ok(Number.isNaN(convert(1, Infinity)));
  assert.ok(Number.isNaN(convert('1', 1)));
});

test('parseApiResponse membaca respons sukses', () => {
  const parsed = parseApiResponse(sample, 'USD');
  assert.equal(parsed.base, 'USD');
  assert.equal(parsed.rates.IDR, 17907.815096);
  assert.ok(parsed.updatedAt instanceof Date);
  assert.ok(parsed.nextUpdateAt instanceof Date);
});

test('parseApiResponse menolak respons gagal', () => {
  assert.throws(
    () => parseApiResponse({ result: 'error', 'error-type': 'unsupported-code' }),
    /unsupported-code/
  );
  assert.throws(() => parseApiResponse(null), /tidak valid/);
  assert.throws(() => parseApiResponse({ result: 'success' }), /tidak valid/);
});

test('parseApiResponse menolak mata uang dasar yang tidak cocok', () => {
  assert.throws(() => parseApiResponse(sample, 'EUR'), /tidak sesuai/);
});

test('parseApiResponse membuang kurs yang tidak valid', () => {
  const parsed = parseApiResponse(
    { result: 'success', base_code: 'USD', rates: { IDR: 16000, BAD: 'x', ZERO: 0, NEG: -1 } },
    'USD'
  );
  assert.deepEqual(Object.keys(parsed.rates), ['IDR']);
});

test('formatMoney memakai digit desimal sesuai mata uang', () => {
  assert.equal(formatMoney(17907.8, 'IDR'), '17.908 IDR');
  assert.equal(formatMoney(1234.5, 'USD'), '1.234,50 USD');
  assert.equal(formatMoney(158.3, 'JPY'), '158 JPY');
});

test('formatMoney tidak membulatkan nilai kecil menjadi nol', () => {
  assert.notEqual(formatMoney(0.0056, 'IDR').split(' ')[0], '0');
  assert.equal(formatMoney(0, 'USD'), '0,00 USD');
});

test('formatMoney menangani nilai tidak terbatas', () => {
  assert.equal(formatMoney(NaN, 'USD'), '-');
});

test('formatRate menampilkan kurs besar dan kecil dengan wajar', () => {
  assert.equal(formatRate(17907.815096), '17.907,8151');
  assert.equal(formatRate(0.0000558), '0,0000558');
  assert.equal(formatRate(NaN), '-');
});

test('currencyName memberi nama atau jatuh balik ke kode', () => {
  assert.equal(typeof currencyName('IDR'), 'string');
  assert.ok(currencyName('IDR').length > 0);
  assert.equal(currencyName('???'), '???');
});
