---
title: "Cara Merapikan dan Memvalidasi JSON serta Memperbaiki Error-nya"
description: "Rapikan atau minify JSON, temukan letak error-nya, dan perbaiki koma berlebih, kutip tunggal, key tanpa kutip, serta komentar."
tool: json-format
related: [json-viewer, json-compare, json-yaml]
updated: 2026-11-16
---

JSON kelihatannya sederhana, tetapi aturannya ketat. Satu koma berlebih, sepasang kutip tunggal, atau komentar `//` sudah cukup membuat API, pembaca konfigurasi, atau `JSON.parse` menolak seluruh isi file. Pesan error-nya sering hanya menyebut posisi karakter di baris 1 dari JSON yang sudah di-minify, jadi tidak banyak membantu. Panduan ini menjelaskan cara merapikan dan memvalidasi JSON dengan [JSON Formatter](/id/tools/json-format/), cara cepat menemukan letak error dengan [JSON Viewer](/id/tools/json-viewer/), dan cara mengenali beberapa kesalahan yang paling sering terjadi.

## Merapikan atau me-minify JSON

1. Buka [JSON Formatter](/id/tools/json-format/), lalu tempel JSON Anda ke kotak **Input JSON**, atau klik **Muat file .json** untuk membuka file dari perangkat.
2. Klik **Format (2 spasi)** atau **Format (4 spasi)** untuk merapikan, atau **Minify** untuk membuang semua spasi dan baris baru sehingga menjadi satu baris.
3. Lihat panel **Hasil**. Setelah salah satu mode dipilih, hasilnya ikut diperbarui saat Anda mengedit input, jadi Anda bisa memperbaiki error dan langsung melihat hasilnya.
4. Klik **Salin**, atau unduh hasilnya sebagai `formatted.json`. Tombol **Bersihkan** mengosongkan semuanya.

Merapikan JSON sekaligus berarti memvalidasinya. Formatter ini memakai parser ketat yang sama dengan `JSON.parse` di browser dan Node.js. Jika hasil muncul, JSON Anda valid. Jika tidak, yang muncul adalah pesan error berwarna merah.

## Menemukan letak error

Teks error di formatter berasal dari parser bawaan browser Anda. Di Chrome dan Edge bentuknya seperti `Expected double-quoted property name in JSON at position 7 (line 1 column 8)`, sedangkan browser lain memakai kalimat yang berbeda. Kalau pesannya kurang jelas, tempel teks yang sama ke [JSON Viewer](/id/tools/json-viewer/):

1. Tempel JSON ke kotak **Masukan** (tombol format **JSON** sudah terpilih secara default).
2. Jika tidak bisa dibaca, viewer menampilkan **Tidak valid JSON — Baris X, kolom Y** beserta penyebabnya. Buka baris itu; kesalahan biasanya ada tepat di posisi tersebut atau sedikit sebelumnya.
3. Perhatikan catatan **Dibaca sebagai JSON5 / JSON dengan komentar.** Artinya viewer hanya bisa membaca teks Anda dengan melonggarkan aturan. Hampir pasti teks tersebut mengandung salah satu dari empat kesalahan di bawah, dan tool atau aplikasi yang ketat akan menolaknya.

## Empat kesalahan yang paling sering membuat JSON tidak valid

**1. Koma di akhir (trailing comma).** JavaScript membolehkan koma setelah item terakhir, JSON tidak.

```
{ "tags": ["a", "b",], "aktif": true, }
```

Hapus koma sebelum `]` dan sebelum `}`. Ini sering terjadi setelah Anda menghapus baris terakhir dari sebuah daftar.

**2. Kutip tunggal.** String dan key di JSON wajib memakai kutip ganda. `{'nama': 'Budi'}` tidak valid, sedangkan `{"nama": "Budi"}` valid. Sumber yang sering terjadi: menyalin hasil `print` dictionary di Python, yang juga memakai `True`, `False`, dan `None`, padahal JSON butuh `true`, `false`, dan `null`.

**3. Key tanpa kutip.** `{nama: "Budi"}` adalah objek JavaScript yang sah, tetapi bukan JSON yang valid. Setiap key harus diapit kutip ganda: `{"nama": "Budi"}`.

**4. Komentar.** JSON standar sama sekali tidak mengenal komentar, baik `// ...` maupun `/* ... */`. File seperti `tsconfig.json` atau `settings.json` milik VS Code sebenarnya berformat "JSON dengan komentar" (JSONC) dan dibaca oleh program yang menerimanya. Kalau file yang sama dikirim ke parser ketat, hasilnya gagal.

Kesalahan lain yang perlu dicek: koma yang hilang di antara dua item (sering terjadi setelah menempel baris baru), `}` atau `]` penutup yang hilang, baris baru atau tab mentah di dalam string (tulis sebagai `\n` dan `\t`), serta nilai seperti `NaN`, `undefined`, atau `0x1F` yang tidak ada di JSON.

## Mengubah JSON berkomentar menjadi JSON standar

Jika viewer membaca file Anda sebagai JSON5/JSONC, Anda bisa memanfaatkannya untuk membersihkan file:

1. Tempel teksnya ke [JSON Viewer](/id/tools/json-viewer/) dan pastikan tampilan pohon (tree) muncul.
2. Arahkan kursor ke baris paling atas di tree (root), lalu klik ikon **Salin nilai**.
3. Clipboard Anda sekarang berisi JSON standar dengan indentasi 2 spasi: komentar terhapus, key memakai kutip ganda, dan koma berlebih hilang. Tempel ke formatter jika Anda ingin versi 4 spasi atau versi minify.

Simpan file aslinya jika komentar di dalamnya masih penting bagi tim yang mengurus file tersebut, karena komentar ikut terbuang.

## Hati-hati: saat merapikan justru mengubah data

Formatter membaca JSON lalu menuliskannya ulang, sehingga ada beberapa hal yang bisa berubah tanpa peringatan. Ini sifat parser JSON di JavaScript, bukan kesalahan di file Anda:

- **Angka bulat yang sangat besar kehilangan presisi.** Angka di atas 9.007.199.254.740.991 tidak bisa disimpan persis, jadi `9007199254740993` berubah menjadi `9007199254740992`. Jika data Anda berisi ID 64-bit (misalnya ID transaksi dari sistem lain), simpan sebagai string, atau jangan rapikan file itu sebelum diteruskan.
- **Key ganda dilebur.** `{"x": 1, "x": 2}` menjadi `{"x": 2}`. Parser menyimpan yang terakhir tanpa memberi tahu, jadi merapikan JSON juga bisa jadi cara menemukan key ganda yang tidak Anda sadari.
- **Key yang berupa angka pindah ke depan.** Pada `{"nama": "a", "10": 1, "2": 2}`, key `"2"` dan `"10"` dicetak lebih dulu dengan urutan angka. Maknanya tetap sama, tetapi diff terhadap file asli akan menunjukkan perpindahan itu.

Untuk memastikan dua versi berisi data yang sama tanpa peduli format dan urutan key, gunakan [JSON Compare](/id/tools/json-compare/).

## Privasi

Proses membaca dan merapikan JSON berjalan di browser Anda, sehingga respons API, token, atau data pelanggan yang Anda tempel tetap berada di perangkat Anda.

## FAQ

### Apakah JSON yang valid pasti benar?

Belum tentu. Valid berarti sintaksnya benar. Apakah field, tipe data, dan nilainya sesuai dengan yang diharapkan API adalah soal lain, yang biasanya dijawab oleh dokumentasi API atau JSON Schema.

### Lebih baik 2 spasi atau 4 spasi?

Keduanya sah, JSON tidak mempermasalahkannya. Ikuti saja yang sudah dipakai di proyek atau tim Anda supaya diff tetap kecil. Gunakan **Minify** hanya untuk data yang dikirim lewat jaringan atau disematkan di tempat yang ukurannya penting.

### Kenapa file saya terbaca di VS Code tetapi gagal di aplikasi?

VS Code membaca banyak file pengaturan sebagai JSON dengan komentar, yang membolehkan komentar dan koma berlebih. Aplikasi Anda kemungkinan memakai parser ketat. Hapus fitur-fitur itu, atau konversi file seperti cara di atas.

### Bisakah viewer membuka file berisi satu objek JSON per baris?

Bisa. JSON Viewer membaca JSON Lines (`.jsonl` atau `.ndjson`) sebagai daftar record dan menyebutkan nomor baris record yang rusak. Formatter hanya menerima satu dokumen JSON, jadi format itu akan ditolak di sana.
