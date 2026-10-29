/*
 * Data tarif acuan untuk estimasi biaya operasi (rupiah).
 * Angka di sini CONTOH untuk simulasi, bukan tarif resmi rumah sakit mana pun.
 * Sesuaikan dengan tarif rumah sakit Anda sebelum dipakai sungguhan.
 */
(function (root) {
  'use strict';

  // Tingkat kerumitan menentukan tarif kamar operasi, bahan habis pakai, dan penunjang.
  var complexity = {
    kecil:  { label: 'Kecil',  orPerHour: 1500000, supplies: 1000000,  diagnostics: 500000 },
    sedang: { label: 'Sedang', orPerHour: 2500000, supplies: 3000000,  diagnostics: 1500000 },
    besar:  { label: 'Besar',  orPerHour: 4000000, supplies: 6000000,  diagnostics: 3000000 },
    khusus: { label: 'Khusus', orPerHour: 7000000, supplies: 20000000, diagnostics: 8000000 }
  };

  // Pengali untuk jasa dokter, kamar operasi, dan kamar rawat.
  var roomClasses = {
    kelas3: { label: 'Kelas 3', factor: 0.6, perDay: 350000 },
    kelas2: { label: 'Kelas 2', factor: 0.8, perDay: 700000 },
    kelas1: { label: 'Kelas 1', factor: 1.0, perDay: 1200000 },
    vip:    { label: 'VIP',     factor: 1.5, perDay: 2500000 },
    vvip:   { label: 'Suite / VVIP', factor: 2.0, perDay: 4000000 }
  };

  // Pengali harga menurut jenis rumah sakit (tidak berlaku untuk implan dan biaya lain).
  var hospitalTypes = {
    pemda:   { label: 'RS pemda (Tipe C/D)', factor: 0.85 },
    rujukan: { label: 'RS rujukan (Tipe A/B)', factor: 1.0 },
    swasta:  { label: 'RS swasta menengah', factor: 1.3 },
    premium: { label: 'RS swasta premium', factor: 1.7 }
  };

  // Jasa anestesi sebagai persentase jasa operator.
  var anesthesia = {
    umum:   { label: 'Anestesi umum', rate: 0.35 },
    spinal: { label: 'Spinal / regional', rate: 0.25 },
    lokal:  { label: 'Anestesi lokal', rate: 0.08 },
    none:   { label: 'Tanpa anestesi', rate: 0 }
  };

  var rules = {
    teamRate: 0.3,         // asisten bedah + perawat instrumen/sirkuler, % jasa operator
    emergencyRate: 0.25,   // tambahan operasi cito/darurat atas jasa medis dan kamar operasi
    icuPerDay: 3500000,    // tarif ICU per hari (kelas 1 = pengali 1.0)
    lowFactor: 0.9,        // batas bawah rentang estimasi
    highFactor: 1.25       // batas atas rentang (cadangan komplikasi/perpanjangan rawat)
  };

  // fee = jasa operator (kelas 1, RS pengali 1.0); hours = lama operasi; days = rawat inap;
  // icu = hari ICU; implant = perkiraan implan/alat khusus (rupiah).
  var procedures = [
    { id: 'apendektomi',   group: 'Bedah umum', name: 'Apendektomi (usus buntu)',        complexity: 'sedang', fee: 6000000,  hours: 1.5,  days: 3, icu: 0, anesthesia: 'spinal', implant: 0 },
    { id: 'hernia',        group: 'Bedah umum', name: 'Herniorafi (hernia)',             complexity: 'sedang', fee: 5500000,  hours: 1.5,  days: 2, icu: 0, anesthesia: 'spinal', implant: 2000000 },
    { id: 'kolesistektomi',group: 'Bedah umum', name: 'Kolesistektomi laparoskopi (batu empedu)', complexity: 'besar', fee: 12000000, hours: 2, days: 3, icu: 0, anesthesia: 'umum', implant: 0 },
    { id: 'eksisi',        group: 'Bedah umum', name: 'Eksisi tumor jinak / kista',      complexity: 'kecil',  fee: 2500000,  hours: 1,    days: 1, icu: 0, anesthesia: 'lokal',  implant: 0 },
    { id: 'sirkumsisi',    group: 'Bedah umum', name: 'Sirkumsisi',                      complexity: 'kecil',  fee: 1500000,  hours: 0.5,  days: 0, icu: 0, anesthesia: 'lokal',  implant: 0 },

    { id: 'sc',            group: 'Kebidanan',  name: 'Sectio caesarea',                 complexity: 'besar',  fee: 9000000,  hours: 1.5,  days: 3, icu: 0, anesthesia: 'spinal', implant: 0 },
    { id: 'histerektomi',  group: 'Kebidanan',  name: 'Histerektomi (angkat rahim)',     complexity: 'besar',  fee: 12000000, hours: 2.5,  days: 4, icu: 0, anesthesia: 'umum',   implant: 0 },
    { id: 'kuretase',      group: 'Kebidanan',  name: 'Kuretase',                        complexity: 'kecil',  fee: 2500000,  hours: 0.5,  days: 1, icu: 0, anesthesia: 'umum',   implant: 0 },

    { id: 'orif',          group: 'Ortopedi',   name: 'ORIF patah tulang (pen / plat)',  complexity: 'besar',  fee: 14000000, hours: 2.5,  days: 4, icu: 0, anesthesia: 'spinal', implant: 8000000 },
    { id: 'tkr',           group: 'Ortopedi',   name: 'Penggantian sendi lutut total',   complexity: 'khusus', fee: 30000000, hours: 3,    days: 5, icu: 0, anesthesia: 'spinal', implant: 40000000 },
    { id: 'artroskopi',    group: 'Ortopedi',   name: 'Artroskopi lutut',                complexity: 'besar',  fee: 15000000, hours: 2,    days: 2, icu: 0, anesthesia: 'spinal', implant: 3000000 },

    { id: 'tonsilektomi',  group: 'THT & Mata', name: 'Tonsilektomi',                    complexity: 'sedang', fee: 5000000,  hours: 1,    days: 2, icu: 0, anesthesia: 'umum',   implant: 0 },
    { id: 'katarak',       group: 'THT & Mata', name: 'Katarak (fakoemulsifikasi + lensa)', complexity: 'sedang', fee: 6000000, hours: 0.75, days: 1, icu: 0, anesthesia: 'lokal', implant: 2500000 },

    { id: 'turp',          group: 'Urologi',    name: 'TURP (prostat)',                  complexity: 'besar',  fee: 11000000, hours: 2,    days: 3, icu: 0, anesthesia: 'spinal', implant: 0 },
    { id: 'urs',           group: 'Urologi',    name: 'URS / pengangkatan batu saluran kemih', complexity: 'besar', fee: 10000000, hours: 1.5, days: 2, icu: 0, anesthesia: 'spinal', implant: 1500000 },

    { id: 'cabg',          group: 'Jantung & saraf', name: 'Bedah pintas jantung (CABG)', complexity: 'khusus', fee: 60000000, hours: 5, days: 8, icu: 2, anesthesia: 'umum', implant: 25000000 },
    { id: 'kraniotomi',    group: 'Jantung & saraf', name: 'Kraniotomi',                 complexity: 'khusus', fee: 45000000, hours: 4,    days: 7, icu: 2, anesthesia: 'umum',   implant: 10000000 }
  ];

  var api = {
    complexity: complexity,
    roomClasses: roomClasses,
    hospitalTypes: hospitalTypes,
    anesthesia: anesthesia,
    rules: rules,
    procedures: procedures
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TarifOperasi = api;
})(typeof window !== 'undefined' ? window : globalThis);
