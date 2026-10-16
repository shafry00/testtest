/*
 * Kalkulator kurs sederhana.
 * Kurs diambil dari https://open.er-api.com (ExchangeRate-API, tanpa API key).
 */
(function () {
  'use strict';

  var K = window.KursConverter;

  var API_URL = 'https://open.er-api.com/v6/latest/';
  var CACHE_TTL_MS = 60 * 60 * 1000; // API memperbarui kurs sehari sekali, 1 jam sudah cukup hemat
  var CACHE_PREFIX = 'kurs:v1:';
  var PREF_KEY = 'kurs:v1:pref';
  var FALLBACK_CODES = ['IDR', 'USD', 'EUR', 'SGD', 'JPY', 'MYR', 'AUD', 'GBP', 'CNY', 'SAR'];

  var els = {
    form: document.getElementById('kurs-form'),
    amount: document.getElementById('amount'),
    from: document.getElementById('from'),
    to: document.getElementById('to'),
    swap: document.getElementById('swap'),
    refresh: document.getElementById('refresh'),
    result: document.getElementById('result'),
    rate: document.getElementById('rate'),
    updated: document.getElementById('updated'),
    status: document.getElementById('status')
  };

  var memory = {};
  var requestId = 0;
  var currenciesReady = false;

  /* ---------- penyimpanan ---------- */

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* localStorage bisa tidak tersedia (mode privat); abaikan saja */
    }
  }

  /* ---------- ambil kurs ---------- */

  function fresh(entry) {
    return entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
  }

  async function getRates(base, force) {
    var cached = memory[base] || readJSON(CACHE_PREFIX + base);
    if (!force && fresh(cached)) {
      memory[base] = cached;
      return cached;
    }
    try {
      var res = await fetch(API_URL + encodeURIComponent(base));
      if (!res.ok) throw new Error('Server kurs membalas HTTP ' + res.status);
      var parsed = K.parseApiResponse(await res.json(), base);
      var entry = {
        fetchedAt: Date.now(),
        rates: parsed.rates,
        updatedAt: parsed.updatedAt ? parsed.updatedAt.getTime() : null
      };
      memory[base] = entry;
      writeJSON(CACHE_PREFIX + base, entry);
      return entry;
    } catch (err) {
      if (cached) {
        // Gagal ambil data baru, pakai data lama yang masih tersimpan.
        return Object.assign({}, cached, { stale: true });
      }
      throw err;
    }
  }

  /* ---------- tampilan ---------- */

  function setStatus(message, isError) {
    els.status.textContent = message || '';
    els.status.classList.toggle('error', Boolean(isError));
  }

  function fillSelect(select, codes, selected) {
    select.innerHTML = '';
    codes.forEach(function (code) {
      var option = document.createElement('option');
      option.value = code;
      option.textContent = code + ' - ' + K.currencyName(code);
      select.appendChild(option);
    });
    if (codes.indexOf(selected) !== -1) select.value = selected;
  }

  function populateCurrencies(codes) {
    var pref = readJSON(PREF_KEY) || {};
    var from = pref.from || 'USD';
    var to = pref.to || 'IDR';
    fillSelect(els.from, codes, from);
    fillSelect(els.to, codes, to);
  }

  function showPlaceholder() {
    els.result.textContent = '-';
    els.rate.textContent = '';
    els.updated.textContent = '';
  }

  function readAmount() {
    var raw = els.amount.value;
    if (raw === '') return NaN;
    return Number(raw);
  }

  async function update(force) {
    var thisRequest = ++requestId;
    var from = els.from.value;
    var to = els.to.value;
    var amount = readAmount();

    if (!from || !to) return;
    writeJSON(PREF_KEY, { from: from, to: to });

    if (!Number.isFinite(amount) || amount < 0) {
      showPlaceholder();
      setStatus('Masukkan jumlah uang berupa angka 0 atau lebih.', true);
      return;
    }

    setStatus('Mengambil kurs...');
    try {
      var data = await getRates(from, force);
      if (thisRequest !== requestId) return; // ada permintaan yang lebih baru
      var rate = data.rates[to];
      if (!rate) throw new Error('Kurs ' + from + ' ke ' + to + ' tidak tersedia');

      els.result.textContent =
        K.formatMoney(amount, from) + ' = ' + K.formatMoney(K.convert(amount, rate), to);
      els.rate.textContent = '1 ' + from + ' = ' + K.formatRate(rate) + ' ' + to;
      els.updated.textContent = data.updatedAt
        ? 'Kurs diperbarui ' + new Date(data.updatedAt).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short'
          })
        : '';
      setStatus(
        data.stale ? 'Tidak bisa mengambil kurs terbaru, memakai data tersimpan terakhir.' : '',
        Boolean(data.stale)
      );
    } catch (err) {
      if (thisRequest !== requestId) return;
      showPlaceholder();
      setStatus(err.message + '. Periksa koneksi internet lalu tekan "Segarkan kurs".', true);
    }
  }

  async function init() {
    setStatus('Memuat daftar mata uang...');
    try {
      var data = await getRates('USD', false);
      populateCurrencies(Object.keys(data.rates).sort());
      currenciesReady = true; // daftar lengkap dari API sudah dimuat
    } catch (err) {
      populateCurrencies(FALLBACK_CODES);
      showPlaceholder();
      setStatus(err.message + '. Periksa koneksi internet lalu tekan "Segarkan kurs".', true);
      return;
    }
    update(false);
  }

  /* ---------- event ---------- */

  els.form.addEventListener('submit', function (event) {
    event.preventDefault();
    update(false);
  });
  els.amount.addEventListener('input', function () { update(false); });
  els.from.addEventListener('change', function () { update(false); });
  els.to.addEventListener('change', function () { update(false); });

  els.swap.addEventListener('click', function () {
    var from = els.from.value;
    els.from.value = els.to.value;
    els.to.value = from;
    update(false);
  });

  els.refresh.addEventListener('click', function () {
    if (!currenciesReady) {
      init();
    } else {
      update(true);
    }
  });

  init();
})();
