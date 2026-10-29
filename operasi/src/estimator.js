/*
 * Logika murni estimasi biaya operasi (tanpa DOM), supaya bisa diuji di Node.
 * Semua nilai uang dalam rupiah dan dibulatkan ke Rp1.000 per baris.
 */
(function (root) {
  'use strict';

  var ROUND_TO = 1000;

  function roundMoney(value) {
    return Math.round(value / ROUND_TO) * ROUND_TO;
  }

  /** Angka tidak negatif; nilai tidak valid jadi fallback. */
  function nonNegative(value, fallback) {
    var n = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  function findProcedure(tarif, id) {
    for (var i = 0; i < tarif.procedures.length; i++) {
      if (tarif.procedures[i].id === id) return tarif.procedures[i];
    }
    return null;
  }

  /** Nilai bawaan form saat sebuah tindakan dipilih. */
  function defaultsFor(procedure) {
    return {
      hours: procedure.hours,
      days: procedure.days,
      icuDays: procedure.icu,
      anesthesia: procedure.anesthesia,
      implant: procedure.implant
    };
  }

  /**
   * Hitung estimasi.
   * input: { procedure, roomClass, hospitalType, anesthesia, hours, days, icuDays,
   *          implant, otherCosts, emergency, coveragePercent, coverageLimit }
   * Melempar Error jika pilihan tidak dikenal.
   */
  function estimate(input, tarif) {
    var procedure = findProcedure(tarif, input.procedure);
    if (!procedure) throw new Error('Tindakan operasi tidak dikenal');
    var room = tarif.roomClasses[input.roomClass];
    if (!room) throw new Error('Kelas perawatan tidak dikenal');
    var hospital = tarif.hospitalTypes[input.hospitalType];
    if (!hospital) throw new Error('Jenis rumah sakit tidak dikenal');
    var anesthesia = tarif.anesthesia[input.anesthesia];
    if (!anesthesia) throw new Error('Jenis anestesi tidak dikenal');
    var level = tarif.complexity[procedure.complexity];
    var rules = tarif.rules;

    var hours = nonNegative(input.hours, procedure.hours);
    var days = nonNegative(input.days, procedure.days);
    var icuDays = nonNegative(input.icuDays, procedure.icu);
    var implant = nonNegative(input.implant, 0);
    var otherCosts = nonNegative(input.otherCosts, 0);
    var emergency = Boolean(input.emergency);
    var surcharge = emergency ? 1 + rules.emergencyRate : 1;
    var scale = room.factor * hospital.factor;

    var surgeon = procedure.fee * scale * surcharge;
    var lines = [
      { key: 'operator', label: 'Jasa dokter bedah', amount: surgeon },
      { key: 'anesthesia', label: 'Jasa dokter anestesi (' + anesthesia.label.toLowerCase() + ')',
        amount: surgeon * anesthesia.rate },
      { key: 'team', label: 'Tim bedah (asisten dan perawat)', amount: surgeon * rules.teamRate },
      { key: 'or', label: 'Kamar operasi (' + hours + ' jam)',
        amount: level.orPerHour * hours * scale * surcharge },
      { key: 'supplies', label: 'Obat dan bahan habis pakai', amount: level.supplies * hospital.factor },
      { key: 'diagnostics', label: 'Laboratorium dan radiologi', amount: level.diagnostics * hospital.factor },
      { key: 'room', label: 'Kamar rawat ' + room.label + ' (' + days + ' hari)',
        amount: room.perDay * days * hospital.factor },
      { key: 'icu', label: 'Ruang ICU (' + icuDays + ' hari)',
        amount: rules.icuPerDay * icuDays * hospital.factor },
      { key: 'implant', label: 'Implan / alat khusus', amount: implant },
      { key: 'other', label: 'Biaya lain', amount: otherCosts }
    ].map(function (line) {
      return { key: line.key, label: line.label, amount: roundMoney(line.amount) };
    }).filter(function (line) { return line.amount > 0; });

    var total = lines.reduce(function (sum, line) { return sum + line.amount; }, 0);

    var coveragePercent = Math.min(nonNegative(input.coveragePercent, 0), 100);
    var covered = total * coveragePercent / 100;
    var limit = input.coverageLimit === '' || input.coverageLimit == null
      ? Infinity
      : nonNegative(input.coverageLimit, Infinity);
    covered = roundMoney(Math.min(covered, limit));

    return {
      procedure: procedure,
      lines: lines,
      total: total,
      low: roundMoney(total * rules.lowFactor),
      high: roundMoney(total * rules.highFactor),
      covered: covered,
      patientPays: total - covered
    };
  }

  /** "Rp 12.345.000" dengan pemisah ribuan titik. */
  function formatRupiah(value) {
    var n = Math.round(Number(value) || 0);
    var digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '-Rp ' : 'Rp ') + digits;
  }

  var api = {
    estimate: estimate,
    defaultsFor: defaultsFor,
    findProcedure: findProcedure,
    roundMoney: roundMoney,
    formatRupiah: formatRupiah
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EstimasiOperasi = api;
})(typeof window !== 'undefined' ? window : globalThis);
