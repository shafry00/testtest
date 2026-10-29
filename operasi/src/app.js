/*
 * Penghubung form estimasi biaya operasi ke logika di estimator.js.
 */
(function () {
  'use strict';

  var T = window.TarifOperasi;
  var E = window.EstimasiOperasi;
  var PREF_KEY = 'operasi:v1:pref';

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    form: $('form'),
    procedure: $('procedure'),
    procHint: $('proc-hint'),
    hospitalType: $('hospitalType'),
    roomClass: $('roomClass'),
    anesthesia: $('anesthesia'),
    hours: $('hours'),
    days: $('days'),
    icuDays: $('icuDays'),
    implant: $('implant'),
    otherCosts: $('otherCosts'),
    emergency: $('emergency'),
    coveragePercent: $('coveragePercent'),
    coverageLimit: $('coverageLimit'),
    reset: $('reset'),
    total: $('total'),
    range: $('range'),
    breakdown: $('breakdown').tBodies[0],
    covered: $('covered'),
    patient: $('patient'),
    status: $('status'),
    copy: $('copy')
  };

  var lastText = '';

  function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) { return {}; }
  }

  function writePrefs() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({
        hospitalType: els.hospitalType.value,
        roomClass: els.roomClass.value
      }));
    } catch (e) { /* mode privat: abaikan */ }
  }

  function fillSelect(select, map, valueOf) {
    Object.keys(map).forEach(function (key) {
      var option = document.createElement('option');
      option.value = key;
      option.textContent = map[key].label + (valueOf ? valueOf(map[key]) : '');
      select.appendChild(option);
    });
  }

  function fillProcedures() {
    var groups = {};
    T.procedures.forEach(function (p) {
      if (!groups[p.group]) {
        groups[p.group] = document.createElement('optgroup');
        groups[p.group].label = p.group;
        els.procedure.appendChild(groups[p.group]);
      }
      var option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name;
      groups[p.group].appendChild(option);
    });
  }

  function applyDefaults() {
    var d = E.defaultsFor(E.findProcedure(T, els.procedure.value));
    els.hours.value = d.hours;
    els.days.value = d.days;
    els.icuDays.value = d.icuDays;
    els.anesthesia.value = d.anesthesia;
    els.implant.value = d.implant;
    var p = E.findProcedure(T, els.procedure.value);
    els.procHint.textContent = 'Kerumitan ' + T.complexity[p.complexity].label.toLowerCase() +
      '. Nilai di bawah terisi otomatis dan boleh diubah.';
  }

  function input() {
    return {
      procedure: els.procedure.value,
      hospitalType: els.hospitalType.value,
      roomClass: els.roomClass.value,
      anesthesia: els.anesthesia.value,
      hours: els.hours.value,
      days: els.days.value,
      icuDays: els.icuDays.value,
      implant: els.implant.value,
      otherCosts: els.otherCosts.value,
      emergency: els.emergency.checked,
      coveragePercent: els.coveragePercent.value,
      coverageLimit: els.coverageLimit.value
    };
  }

  function setStatus(message, isError) {
    els.status.textContent = message || '';
    els.status.classList.toggle('error', Boolean(isError));
  }

  function render() {
    var result;
    try {
      result = E.estimate(input(), T);
    } catch (err) {
      els.total.textContent = '-';
      els.range.textContent = '';
      els.breakdown.innerHTML = '';
      lastText = '';
      setStatus(err.message, true);
      return;
    }
    setStatus('');
    els.total.textContent = E.formatRupiah(result.total);
    els.range.textContent = 'Kisaran ' + E.formatRupiah(result.low) + ' - ' + E.formatRupiah(result.high);
    els.breakdown.innerHTML = '';
    result.lines.forEach(function (line) {
      var tr = els.breakdown.insertRow();
      tr.insertCell().textContent = line.label;
      tr.insertCell().textContent = E.formatRupiah(line.amount);
    });
    els.covered.textContent = E.formatRupiah(result.covered);
    els.patient.textContent = E.formatRupiah(result.patientPays);

    var lines = [
      'Estimasi biaya: ' + result.procedure.name,
      T.hospitalTypes[els.hospitalType.value].label + ', ' + T.roomClasses[els.roomClass.value].label +
        (els.emergency.checked ? ', darurat' : '')
    ];
    result.lines.forEach(function (l) { lines.push('- ' + l.label + ': ' + E.formatRupiah(l.amount)); });
    lines.push('Total: ' + E.formatRupiah(result.total) +
      ' (kisaran ' + E.formatRupiah(result.low) + ' - ' + E.formatRupiah(result.high) + ')');
    lines.push('Ditanggung asuransi: ' + E.formatRupiah(result.covered));
    lines.push('Dibayar pasien: ' + E.formatRupiah(result.patientPays));
    lines.push('Simulasi berdasarkan tarif contoh, bukan tarif resmi rumah sakit.');
    lastText = lines.join('\n');
  }

  async function copy() {
    if (!lastText) return;
    try {
      await navigator.clipboard.writeText(lastText);
      setStatus('Rincian disalin.');
    } catch (e) {
      setStatus('Tidak bisa menyalin otomatis. Salin manual dari rincian di atas.', true);
    }
  }

  function init() {
    fillProcedures();
    fillSelect(els.hospitalType, T.hospitalTypes);
    fillSelect(els.roomClass, T.roomClasses);
    fillSelect(els.anesthesia, T.anesthesia);

    var pref = readPrefs();
    if (T.hospitalTypes[pref.hospitalType]) els.hospitalType.value = pref.hospitalType;
    els.roomClass.value = T.roomClasses[pref.roomClass] ? pref.roomClass : 'kelas1';

    applyDefaults();
    render();
  }

  els.form.addEventListener('submit', function (e) { e.preventDefault(); });
  els.form.addEventListener('input', function () { writePrefs(); render(); });
  els.procedure.addEventListener('change', function () { applyDefaults(); render(); });
  els.reset.addEventListener('click', function () { applyDefaults(); render(); });
  els.copy.addEventListener('click', copy);

  init();
})();
