---
title: "Cara Membuat Password Kuat yang Tidak Perlu Dipakai Ulang"
description: "Buat password acak yang kuat, pahami kenapa panjang lebih penting dari variasi karakter, kapan pakai passphrase, dan peran password manager."
tool: password-gen
related: [qr-gen]
updated: 2026-11-16
---

Kebanyakan akun dibobol bukan karena ada orang yang berhasil menebak password yang rumit. Akun dibobol karena password yang sama juga dipakai di situs lain yang datanya bocor, lalu pelaku mencoba pasangan email dan password itu di mana-mana, mulai dari email, marketplace, sampai e-wallet. Jadi password yang kuat punya dua tugas: sulit ditebak, dan hanya dipakai di satu tempat. Panduan ini membahas keduanya, dengan [Password Generator](/id/tools/password-gen/) untuk bagian pertama.

## Langkah membuat password

1. Buka [Password Generator](/id/tools/password-gen/). Password 16 karakter berisi huruf kecil, huruf besar, angka, dan simbol langsung dibuat.
2. Geser slider **Panjang**. Rentangnya ditentukan oleh **Min karakter** dan **Maks karakter** (default 8 dan 32). Untuk password lebih dari 32 karakter, naikkan **Maks karakter**; nilainya bisa sampai 128.
3. Centang atau hapus centang **Lowercase**, **Uppercase**, **Numbers**, dan **Symbols** (label ini tampil dalam bahasa Inggris). Minimal satu karakter dari setiap kelompok yang dicentang selalu disertakan, dan posisinya diacak.
4. Jika sebuah situs mewajibkan beberapa angka atau karakter khusus, atur **Min angka** atau **Min karakter khusus** (0 sampai 9).
5. Centang **Hindari karakter ambigu** jika password itu nantinya akan dibacakan atau diketik dari kertas. Opsi ini membuang karakter yang mirip satu sama lain, seperti `I`, `l`, `1`, `O`, `0`, `o`, `B`, `8`, `S`, `5`, `Z`, dan `2`.
6. Lihat label **Kekuatan**, lalu klik **Salin**. Ikon refresh (**Buat ulang**) membuat password baru dengan pengaturan yang sama; mengubah opsi juga langsung menghasilkan password baru.

Password dibuat dengan generator angka acak kriptografis milik browser (`crypto.getRandomValues`), bukan `Math.random`, dan setiap karakter dipilih tanpa bias.

## Panjang lebih penting daripada variasi karakter

Label kekuatan dihitung dari entropi, yaitu seberapa banyak tebakan yang dibutuhkan untuk password acak dengan bentuk tersebut. Setiap tambahan satu karakter melipatgandakan kemungkinan sebesar jumlah karakter yang tersedia, sehingga menambah panjang jauh lebih efektif daripada menambah jenis karakter. Dengan himpunan karakter yang dipakai tool ini:

| Pengaturan | Perkiraan entropi | Label kekuatan |
| --- | --- | --- |
| 8 karakter, keempat jenis | 52 bit | Fair |
| 12 karakter, keempat jenis | 77 bit | Strong |
| 16 karakter, keempat jenis | 103 bit | Very strong |
| 16 karakter, huruf kecil saja | 75 bit | Strong |
| 22 karakter, huruf kecil saja | 103 bit | Very strong |

Label kekuatan juga tampil dalam bahasa Inggris (Weak, Fair, Strong, Very strong) dan berganti di batas 40, 70, dan 100 bit. Perhatikan: password 22 huruf kecil sama kuatnya dengan password campuran 16 karakter, dan jauh lebih mudah diketik di keyboard ponsel.

Dua hal lain yang perlu diketahui:

- **Menghindari karakter ambigu memperkecil pilihan karakter** dari 87 menjadi 75, sehingga password 16 karakter turun menjadi sekitar 100 bit dan berlabel **Strong**, bukan **Very strong**. Tambahkan satu atau dua karakter untuk mengimbanginya.
- **Jika sebuah situs menolak simbol**, hapus centang **Symbols** dan tambah panjangnya. Enam belas huruf dan angka memberi sekitar 95 bit; 18 karakter sekitar 107 bit.

Meter kekuatan hanya berlaku untuk password buatan tool ini. Password karangan sendiri seperti `Jakarta2026!` mengikuti pola yang mudah ditebak dan jauh lebih lemah daripada kesan panjangnya.

## Kapan passphrase lebih cocok

Ada password yang memang harus Anda hafal dan ketik sendiri: master password untuk password manager, login laptop, mungkin juga ponsel. Untuk yang seperti ini, passphrase dari kata-kata acak lebih praktis daripada deretan simbol. Tool ini tidak membuat passphrase, jadi lakukan dengan cara berikut:

1. Gunakan daftar kata yang memang dibuat untuk keperluan ini, misalnya EFF large word list yang berisi 7.776 kata bahasa Inggris.
2. Pilih kata secara acak, misalnya dengan melempar lima dadu untuk setiap kata seperti petunjuk di daftar tersebut. Jangan memilih kata sendiri, karena pilihan manusia cenderung mudah ditebak.
3. Pakai minimal enam kata. Setiap kata dari daftar 7.776 kata menyumbang sekitar 12,9 bit, jadi enam kata memberi sekitar 77 bit dan delapan kata sekitar 103 bit.

Hasilnya, misalnya `crane-velvet-oyster-mural-pebble-lantern`, panjang, acak, tetapi tetap bisa diketik. Kutipan terkenal atau lirik lagu, sepanjang apa pun, tidak termasuk acak.

## Pakai password manager agar tidak ada password yang dipakai ulang

Tidak ada yang sanggup menghafal password unik 16 karakter untuk setiap akun, dan memang tidak perlu. Password manager menyimpan semuanya dalam keadaan terenkripsi, dibuka dengan satu master passphrase.

- Pilihannya antara lain password manager bawaan perangkat Apple, Google Chrome dan Android, Firefox, serta aplikasi terpisah seperti Bitwarden, 1Password, atau KeePassXC.
- Saat mendaftar di sebuah situs, buat password, tempel, lalu langsung simpan di password manager sebelum tab ditutup.
- Ganti dulu password yang dipakai ulang di akun paling penting: email, m-banking dan e-wallet, serta media sosial. Siapa pun yang menguasai email Anda bisa me-reset hampir semua akun lainnya.
- Aktifkan verifikasi dua langkah di mana pun tersedia, sebaiknya memakai aplikasi autentikator atau passkey daripada SMS.
- Jangan pernah mengirim password lewat chat atau email. Untuk membagikan password Wi-Fi ke tamu, QR code Wi-Fi dari [Pembuat QR Code](/id/tools/qr-gen/) membuat Anda tidak perlu mendiktekannya.

## Privasi

Password dibuat di browser Anda dan tidak dikirim atau disimpan di server mana pun. Setelah menyalinnya, tutup tab atau tekan buat ulang jika ada orang lain yang bisa melihat layar Anda.

## FAQ

### Apakah 16 karakter sudah cukup?

Untuk password acak yang disimpan di password manager, 16 karakter dengan keempat jenis karakter (sekitar 103 bit) jauh di luar jangkauan upaya penebakan, baik online maupun offline. Pakai lebih panjang jika situsnya mengizinkan; tidak ada ruginya karena password manager yang mengetikkannya.

### Apakah password perlu diganti secara berkala?

Tidak perlu berdasarkan jadwal. Ganti password jika ada alasannya: situs tersebut mengumumkan kebocoran data, Anda pernah membagikannya, atau password itu dipakai juga di tempat lain. Password unik dan kuat yang tidak pernah bocor tidak menjadi lemah karena umurnya.

### Kenapa sebuah situs menolak password yang saya buat?

Sebagian situs membatasi panjang atau jenis simbol yang boleh dipakai. Turunkan **Maks karakter**, atau hapus centang **Symbols** lalu tambah panjangnya agar kekuatannya tetap terjaga.

### Apakah aman membuat password di browser?

Keacakannya berasal dari generator kriptografis yang sama dengan yang dipakai browser untuk enkripsi, dan password tetap berada di perangkat Anda. Risiko yang lebih besar justru setelahnya, jadi simpan di password manager, bukan di aplikasi catatan atau tangkapan layar.
