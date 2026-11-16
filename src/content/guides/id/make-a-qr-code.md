---
title: "Cara Membuat QR Code untuk Link, Wi-Fi, atau Kontak"
description: "Buat QR code untuk link, Wi-Fi, atau kartu kontak, pilih koreksi kesalahan yang tepat, dan cetak dengan ukuran yang mudah dipindai."
tool: qr-gen
related: [qr-read, image-qr, qris-decoder]
updated: 2026-11-16
---

QR code baru berguna kalau langsung terbaca saat dipindai. Kebanyakan QR code yang gagal penyebabnya sepele: ada salah ketik di link, ukuran cetaknya terlalu kecil untuk jarak pindai, ditempel di latar yang ramai, atau file PNG kecil diperbesar sampai buram. Panduan ini menjelaskan cara membuat QR code dengan [Pembuat QR Code](/id/tools/qr-gen/) dan cara mengeceknya sebelum Anda mencetak banyak lembar, misalnya untuk menu warung, stiker meja kafe, atau undangan.

## Apa saja yang bisa dimasukkan ke QR code

Tool ini hanya punya satu kotak berlabel **Teks atau URL**. Apa pun yang Anda ketik di sana disimpan di dalam QR code persis seperti yang ditulis. Tidak ada formulir khusus "Wi-Fi" atau "kontak". Sebagai gantinya, ponsel mengenali beberapa format teks standar dan memperlakukannya secara khusus. Anda bisa mengetik salah satu format berikut ke kotak tersebut:

- **Link situs web**, misalnya `https://contoh.com/menu`. Selalu sertakan `https://` agar pemindai mengenalinya sebagai link, bukan teks biasa.
- **Login Wi-Fi**: `WIFI:T:WPA;S:WarkopTamu;P:kopi2026;;`. `T` adalah jenis keamanan (`WPA` atau `WEP`, atau `nopass` untuk jaringan terbuka), `S` nama jaringan, dan `P` kata sandinya. Kalau nama atau kata sandi mengandung `;`, `,`, `:`, `\` atau `"`, tambahkan garis miring terbalik (`\`) di depan karakter itu.
- **Kartu kontak** (vCard). Kotaknya bisa diisi beberapa baris, jadi Anda bisa menempelkan:

```
BEGIN:VCARD
VERSION:3.0
FN:Rina Putri
TEL:+6281234567890
EMAIL:rina@contoh.com
END:VCARD
```

- **Pintasan email, telepon, atau SMS**: `mailto:halo@contoh.com`, `tel:+6281234567890`, atau `sms:+6281234567890`.
- **Teks biasa**, seperti nomor seri atau catatan singkat.

Kebanyakan aplikasi kamera di ponsel modern akan menawarkan untuk menyambung ke Wi-Fi atau menyimpan kontak saat membaca format di atas, tetapi dukungannya berbeda-beda antaraplikasi. Karena itu, selalu uji dulu (lihat di bawah).

## Langkah membuat dan mengunduh QR code

1. Buka [Pembuat QR Code](/id/tools/qr-gen/), lalu ganti teks contoh di kotak **Teks atau URL** dengan isi Anda. Pratinjau langsung berubah saat Anda mengetik.
2. Pilih **Koreksi kesalahan**: **Rendah (~7%)**, **Sedang (~15%)**, **Kuartil (~25%)**, atau **Tinggi (~30%)**. Persentase itu kira-kira menunjukkan seberapa banyak bagian kode yang boleh rusak atau tertutup tetapi masih bisa terbaca.
3. Klik **Unduh** dan pilih format. Untuk dicetak, pilih **SVG (vector)**. Untuk situs web atau dikirim lewat WhatsApp, **PNG** sudah cukup. Tersedia juga JPEG, WebP, dan AVIF (jika browser mendukung).
4. Atau gunakan **Salin gambar** untuk langsung menempelkannya ke dokumen, atau **Edit di Anotator** untuk menambahkan tulisan seperti "Pindai untuk lihat menu".

Jika muncul pesan **Teks terlalu panjang untuk kode QR**, isinya melebihi kapasitas QR code. Persingkat isinya, atau taruh konten panjang di sebuah halaman web lalu jadikan link-nya sebagai isi QR code.

## Memilih tingkat koreksi kesalahan

Koreksi yang lebih tinggi menambah data cadangan, sehingga polanya makin rapat: link yang sama butuh kotak-kotak yang lebih banyak dan lebih kecil. Jadi ini soal pertimbangan, bukan otomatis lebih baik.

- **Sedang** cocok sebagai pilihan awal untuk layar dan cetakan di dalam ruangan.
- **Kuartil atau Tinggi** membantu untuk stiker di meja, papan nama di luar ruangan, kemasan yang mudah tergores, atau jika Anda ingin menaruh logo kecil di tengah.
- **Rendah** menghasilkan pola paling sederhana, berguna saat teks yang panjang tetap harus dicetak kecil.

Makin pendek isinya, makin besar kotak-kotak polanya di tingkat mana pun. Link pendek lebih mudah dipindai daripada URL panjang yang penuh parameter pelacakan, jadi buang bagian yang tidak perlu.

## Mencetak dengan ukuran yang mudah dipindai

- **Gunakan SVG untuk dicetak.** Pratinjau PNG dirender selebar 320 piksel. Tajam di layar, tetapi kalau diperbesar ke ukuran spanduk akan buram. SVG berbasis vektor sehingga tetap tajam di ukuran berapa pun.
- **Sesuaikan dengan jarak pindai.** Patokan yang umum dipakai: lebar kode sekitar sepersepuluh jarak pindainya. Kode yang dipindai dari 30 cm (kartu di meja) cukup sekitar 3 cm, sedangkan poster yang dipindai dari 2 meter butuh sekitar 20 cm. Lebih besar lebih aman, apalagi untuk kode yang rapat.
- **Sisakan area kosong di sekeliling kode.** Pemindai butuh bingkai kosong di sekitar QR code. File unduhan sudah menyertakan margin putih tipis. Jika Anda menaruhnya di atas latar berwarna atau bermotif, beri ruang kosong tambahan dan jangan memotong margin tersebut.
- **Gelap di atas terang.** Kotak gelap di latar terang paling mudah dibaca. Warna terbalik (terang di atas gelap) atau kombinasi warna yang kontrasnya rendah bisa gagal di sebagian pemindai.
- **Hindari permukaan mengilap dan melengkung**, misalnya botol plastik, karena pantulan cahaya bisa menutupi sebagian pola.

## Uji sebelum dicetak

1. Pindai kode di layar dengan minimal dua ponsel berbeda (idealnya satu iPhone dan satu Android) memakai aplikasi kamera bawaannya.
2. Cetak satu lembar uji di ukuran akhir, lalu pindai dari jarak dan pencahayaan yang sebenarnya.
3. Untuk link, pastikan halaman yang terbuka sudah benar. Untuk Wi-Fi, pastikan ponsel benar-benar tersambung.
4. Unggah tangkapan layar atau foto kode ke [Pembaca QR Code](/id/tools/qr-read/) untuk melihat teks hasil dekode dan menemukan salah ketik, misalnya satu huruf yang hilang di kata sandi Wi-Fi.

## Catatan tentang QRIS

Anda bisa mengetik teks apa pun ke tool ini, tetapi Anda tidak bisa membuat QRIS pembayaran yang berfungsi dengannya. QRIS diterbitkan untuk merchant terdaftar oleh bank atau penyedia jasa pembayaran, dan berisi data merchant serta checksum. Jadi, cetak QRIS yang diberikan oleh penyedia Anda. Untuk melihat isi QRIS yang sudah ada, seperti nama merchant dan kota, gunakan [Dekoder QRIS](/id/tools/qris-decoder/).

## Privasi

QR code dibuat di browser Anda, jadi link, kata sandi Wi-Fi, dan data kontak yang Anda ketik tidak dikirim ke server.

## FAQ

### Apakah QR code dari tool ini bisa kedaluwarsa?

Tidak. Isinya tersimpan di dalam gambar itu sendiri, jadi tidak ada layanan yang bisa dimatikan. Konsekuensinya, isinya tidak bisa diubah belakangan. Kalau link berubah, Anda perlu membuat kode baru. Jika isinya kemungkinan akan berubah, gunakan link yang Anda kelola sendiri lalu ubah tujuan link tersebut.

### Bisakah saya menaruh logo di tengah?

Bisa, tetapi atur koreksi kesalahan ke **Tinggi (~30%)** terlebih dahulu, buat logonya kecil, dan uji hasilnya dengan teliti. Logo bisa ditambahkan lewat **Edit di Anotator** dengan mengimpor gambar. Untuk menempelkan QR code ke foto atau poster yang sudah ada, gunakan [Tambah QR ke Gambar](/id/tools/image-qr/).

### Kenapa QR code Wi-Fi saya tidak bisa tersambung?

Biasanya karena salah ketik di nama jaringan atau kata sandi (keduanya membedakan huruf besar dan kecil), nilai `T:` yang keliru, atau karakter khusus yang belum diberi garis miring terbalik. Dekode dengan [Pembaca QR Code](/id/tools/qr-read/) lalu bandingkan huruf demi huruf.
