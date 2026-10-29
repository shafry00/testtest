'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const tarif = require('../operasi/src/tarif.js');
const { estimate, defaultsFor, findProcedure, roundMoney, formatRupiah } =
  require('../operasi/src/estimator.js');

function base(overrides) {
  const procedure = findProcedure(tarif, 'apendektomi');
  return Object.assign(
    { procedure: 'apendektomi', roomClass: 'kelas1', hospitalType: 'rujukan' },
    defaultsFor(procedure),
    overrides
  );
}

function line(result, key) {
  const found = result.lines.find((l) => l.key === key);
  return found ? found.amount : 0;
}

test('apendektomi kelas 1 RS rujukan dihitung per komponen', () => {
  const r = estimate(base(), tarif);
  assert.equal(line(r, 'operator'), 6000000);
  assert.equal(line(r, 'anesthesia'), 1500000);   // spinal 25%
  assert.equal(line(r, 'team'), 1800000);         // 30%
  assert.equal(line(r, 'or'), 3750000);           // 2,5 jt x 1,5 jam
  assert.equal(line(r, 'supplies'), 3000000);
  assert.equal(line(r, 'diagnostics'), 1500000);
  assert.equal(line(r, 'room'), 3600000);         // 1,2 jt x 3 hari
  assert.equal(r.total, 21150000);
});

test('total sama dengan jumlah semua baris', () => {
  const r = estimate(base({ implant: 1234000, otherCosts: 500000 }), tarif);
  assert.equal(r.total, r.lines.reduce((s, l) => s + l.amount, 0));
});

test('kelas dan jenis rumah sakit menaikkan atau menurunkan biaya', () => {
  const kelas3 = estimate(base({ roomClass: 'kelas3' }), tarif).total;
  const kelas1 = estimate(base(), tarif).total;
  const vip = estimate(base({ roomClass: 'vip' }), tarif).total;
  assert.ok(kelas3 < kelas1 && kelas1 < vip);
  const premium = estimate(base({ hospitalType: 'premium' }), tarif).total;
  assert.ok(premium > kelas1);
});

test('operasi darurat menambah jasa medis dan kamar operasi sebesar 25%', () => {
  const normal = estimate(base(), tarif);
  const cito = estimate(base({ emergency: true }), tarif);
  assert.equal(line(cito, 'operator'), normal.lines[0].amount * 1.25);
  assert.ok(cito.total > normal.total);
  assert.equal(line(cito, 'supplies'), line(normal, 'supplies'));
});

test('baris bernilai nol tidak ditampilkan', () => {
  const r = estimate(base({ implant: 0, icuDays: 0, otherCosts: 0 }), tarif);
  assert.ok(!r.lines.some((l) => ['implant', 'icu', 'other'].includes(l.key)));
});

test('implan tidak dipengaruhi pengali rumah sakit', () => {
  const a = estimate(base({ implant: 5000000, hospitalType: 'pemda' }), tarif);
  const b = estimate(base({ implant: 5000000, hospitalType: 'premium' }), tarif);
  assert.equal(line(a, 'implant'), 5000000);
  assert.equal(line(b, 'implant'), 5000000);
});

test('rentang estimasi mengelilingi total', () => {
  const r = estimate(base(), tarif);
  assert.ok(r.low < r.total && r.total < r.high);
});

test('asuransi menanggung persentase dengan plafon', () => {
  const r = estimate(base({ coveragePercent: 80 }), tarif);
  assert.equal(r.covered, roundMoney(r.total * 0.8));
  assert.equal(r.patientPays, r.total - r.covered);

  const capped = estimate(base({ coveragePercent: 100, coverageLimit: 10000000 }), tarif);
  assert.equal(capped.covered, 10000000);
  assert.equal(capped.patientPays, capped.total - 10000000);

  const over = estimate(base({ coveragePercent: 250 }), tarif);
  assert.equal(over.covered, over.total);
});

test('input tidak valid jatuh ke nilai bawaan atau nol', () => {
  const r = estimate(base({ hours: -2, days: 'abc', implant: '', coveragePercent: 'x' }), tarif);
  const ref = estimate(base(), tarif);
  assert.equal(r.total, ref.total);
  assert.equal(r.covered, 0);
});

test('pilihan tidak dikenal ditolak', () => {
  assert.throws(() => estimate(base({ procedure: 'xx' }), tarif), /Tindakan/);
  assert.throws(() => estimate(base({ roomClass: 'xx' }), tarif), /Kelas/);
  assert.throws(() => estimate(base({ hospitalType: 'xx' }), tarif), /rumah sakit/);
  assert.throws(() => estimate(base({ anesthesia: 'xx' }), tarif), /anestesi/);
});

test('semua tindakan di data tarif bisa dihitung', () => {
  tarif.procedures.forEach((p) => {
    const r = estimate(
      Object.assign({ procedure: p.id, roomClass: 'kelas2', hospitalType: 'swasta' }, defaultsFor(p)),
      tarif
    );
    assert.ok(r.total > 0, p.id);
    assert.ok(tarif.complexity[p.complexity], p.id);
    assert.ok(tarif.anesthesia[p.anesthesia], p.id);
  });
});

test('formatRupiah memakai titik sebagai pemisah ribuan', () => {
  assert.equal(formatRupiah(21150000), 'Rp 21.150.000');
  assert.equal(formatRupiah(0), 'Rp 0');
  assert.equal(formatRupiah(NaN), 'Rp 0');
});
