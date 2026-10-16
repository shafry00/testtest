/*
 * Logika murni kalkulator kurs (tanpa DOM, tanpa network),
 * supaya bisa dipakai di browser dan diuji di Node.
 */
(function (root) {
  'use strict';

  var DEFAULT_LOCALE = 'id-ID';

  /** Hasil = jumlah x kurs. Mengembalikan NaN jika input tidak valid. */
  function convert(amount, rate) {
    if (typeof amount !== 'number' || typeof rate !== 'number') return NaN;
    if (!Number.isFinite(amount) || !Number.isFinite(rate)) return NaN;
    return amount * rate;
  }

  /**
   * Validasi dan rapikan respons dari open.er-api.com.
   * Melempar Error jika respons gagal atau tidak sesuai harapan.
   */
  function parseApiResponse(json, expectedBase) {
    if (!json || json.result !== 'success' || !json.rates || typeof json.rates !== 'object') {
      var reason = json && json['error-type'] ? json['error-type'] : 'respons tidak valid';
      throw new Error('API kurs gagal: ' + reason);
    }
    if (expectedBase && json.base_code && json.base_code !== expectedBase) {
      throw new Error('API kurs mengembalikan mata uang dasar yang tidak sesuai');
    }
    var rates = {};
    Object.keys(json.rates).forEach(function (code) {
      var value = json.rates[code];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) rates[code] = value;
    });
    if (Object.keys(rates).length === 0) throw new Error('API kurs tidak memuat satu pun kurs');
    return {
      base: json.base_code || expectedBase || null,
      rates: rates,
      updatedAt: json.time_last_update_unix ? new Date(json.time_last_update_unix * 1000) : null,
      nextUpdateAt: json.time_next_update_unix ? new Date(json.time_next_update_unix * 1000) : null
    };
  }

  // Standar ISO 4217 menetapkan IDR 2 desimal, tapi dalam praktik rupiah ditulis tanpa sen.
  var DIGIT_OVERRIDES = { IDR: 0 };

  /** Jumlah digit desimal sebuah mata uang (IDR/JPY = 0, USD = 2, dst). */
  function currencyDigits(code) {
    if (Object.prototype.hasOwnProperty.call(DIGIT_OVERRIDES, code)) return DIGIT_OVERRIDES[code];
    try {
      return new Intl.NumberFormat(DEFAULT_LOCALE, { style: 'currency', currency: code })
        .resolvedOptions().maximumFractionDigits;
    } catch (e) {
      return 2;
    }
  }

  /** Contoh: formatMoney(17907.8, 'IDR') -> "17.908 IDR". */
  function formatMoney(value, code, locale) {
    if (!Number.isFinite(value)) return '-';
    var digits = currencyDigits(code);
    var options = { minimumFractionDigits: digits, maximumFractionDigits: digits };
    // Nilai kecil (mis. 0,0056) tidak boleh dibulatkan jadi 0.
    if (value !== 0 && Math.abs(value) < Math.pow(10, -digits)) {
      options = { minimumFractionDigits: 0, maximumSignificantDigits: 4 };
    }
    return new Intl.NumberFormat(locale || DEFAULT_LOCALE, options).format(value) + ' ' + code;
  }

  /** Format kurs: 17907,8151 untuk kurs besar, 6 angka signifikan untuk kurs kecil. */
  function formatRate(rate, locale) {
    if (!Number.isFinite(rate)) return '-';
    var options = Math.abs(rate) >= 1
      ? { maximumFractionDigits: 4 }
      : { maximumSignificantDigits: 6 };
    return new Intl.NumberFormat(locale || DEFAULT_LOCALE, options).format(rate);
  }

  /** Nama mata uang dalam bahasa Indonesia; jatuh balik ke kodenya. */
  function currencyName(code, locale) {
    try {
      var name = new Intl.DisplayNames([locale || DEFAULT_LOCALE], { type: 'currency' }).of(code);
      return name && name !== code ? name : code;
    } catch (e) {
      return code;
    }
  }

  var api = {
    convert: convert,
    parseApiResponse: parseApiResponse,
    formatMoney: formatMoney,
    formatRate: formatRate,
    currencyName: currencyName
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KursConverter = api;
})(typeof window !== 'undefined' ? window : globalThis);
