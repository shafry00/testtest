# Kalkulator Kurs

Kalkulator kurs mata uang sederhana: web statis (HTML, CSS, JavaScript) tanpa framework dan tanpa API key. Mendukung sekitar 160 mata uang, termasuk rupiah.

## Fitur

- Konversi jumlah uang antar mata uang dengan kurs terkini.
- Tombol tukar mata uang asal dan tujuan.
- Menampilkan kurs per 1 unit dan waktu kurs diperbarui.
- Format angka Indonesia (`17.949,09`), rupiah tanpa sen.
- Kurs disimpan di browser selama 1 jam supaya hemat panggilan API. Kalau internet putus, data tersimpan terakhir tetap dipakai dan diberi tanda.
- Pilihan mata uang terakhir diingat, mengikuti mode terang/gelap perangkat.

## Cara menjalankan

Buka `index.html` langsung di browser, atau jalankan server lokal:

```bash
npm start        # lalu buka http://localhost:8000
```

## Tes

Butuh Node.js 18 atau lebih baru. Tidak ada dependensi yang perlu dipasang.

```bash
npm test
```

Tes mencakup perhitungan, validasi respons API, dan format angka.

## API kurs

Data kurs dari [ExchangeRate-API](https://www.exchangerate-api.com) lewat endpoint gratis tanpa key:

```
GET https://open.er-api.com/v6/latest/{KODE_MATA_UANG}
```

Contoh `GET .../latest/USD` mengembalikan `result`, `base_code`, `time_last_update_unix`, dan objek `rates` berisi kurs 1 USD ke tiap mata uang. Kurs diperbarui sekali sehari dan bersifat indikatif, bukan kurs transaksi bank. Atribusi "Rates By Exchange Rate API" ada di footer halaman sesuai ketentuan layanan.

## Struktur

```
index.html            halaman utama
style.css             tampilan
src/converter.js      logika murni: hitung, validasi respons API, format angka
src/app.js            penghubung DOM, pengambilan API, cache
test/converter.test.js  tes logika
```

## Deploy ke GitHub Pages

Settings > Pages > Source: **Deploy from a branch**, pilih branch `main` dan folder `/ (root)`. Situs akan tersedia di `https://shafry00.github.io/testtest/`.
