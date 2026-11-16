---
title: "Cara Kompres Foto Jadi 200 KB untuk Daftar CPNS, Sekolah & Kerja"
description: "Kecilkan foto HP atau hasil scan agar lolos batas unggah 200 KB atau 500 KB di portal CPNS, PPDB, SNBP, atau lamaran kerja tanpa jadi buram."
tool: image-compress
related: [image-resize, compress-to-size, pas-foto]
updated: 2026-11-16
---

Hampir semua pendaftaran online meminta file dengan batas ukuran tertentu, misalnya pas foto maksimal 200 KB, atau scan ijazah dan KTP maksimal 500 KB. Masalahnya, foto dari HP sekarang biasanya beberapa MB. Begitu diunggah, portal menolaknya, padahal tenggat pendaftaran seperti SSCASN atau PPDB sering mepet.

Banyak orang langsung menurunkan kualitas serendah mungkin, lalu hasilnya buram dan pecah. Cara yang lebih rapi ada dua langkah: **perkecil resolusinya dulu, baru kompres**. Panduan ini memakai tool [Kompres Gambar](/id/tools/image-compress/) dan [Pengubah Ukuran Gambar](/id/tools/image-resize/). Keduanya berjalan langsung di browser Anda.

## Cek dulu ketentuan di portal

Sebelum mengedit apa pun, baca petunjuk unggah di portalnya. Perhatikan tiga hal:

- **Ukuran maksimal file.** Batasnya berbeda antarinstansi, bahkan antarkolom dalam satu formulir (pas foto dan scan dokumen bisa beda). Selalu pakai angka yang tertulis di portal Anda, jangan menebak dari pengalaman orang lain.
- **Format yang diterima.** Kebanyakan formulir hanya menerima JPG/JPEG, kadang PNG. Tool kompres bisa menyimpan sebagai WebP, tetapi file `.webp` bisa ditolak kalau portal meminta JPG.
- **Ukuran piksel atau rasio.** Ada portal yang mensyaratkan ukuran atau rasio tertentu (misalnya 3x4) dan warna latar tertentu. Ikuti persis kalau memang tercantum.

## Langkah 1: Perkecil resolusi foto

Tool Kompres Gambar tidak mengubah resolusi. Jadi kalau foto Anda langsung dari kamera HP, kerjakan langkah ini dulu.

1. Buka [Pengubah Ukuran Gambar](/id/tools/image-resize/), lalu letakkan foto ke kotak (atau tempel dengan Ctrl/Cmd+V).
2. Biarkan **Kunci rasio aspek** tetap dicentang supaya foto tidak gepeng.
3. Isi **Lebar** yang baru. Untuk pas foto atau foto profil, sekitar 1000–1200 px di sisi terpanjang sudah lebih dari cukup. Scan dokumen A4 masih terbaca jelas di lebar sekitar 1200–1600 px.
4. Klik **Ubah ukuran**, periksa pratinjaunya, lalu klik tombol **Unduh**.

Format asli tetap dipertahankan, jadi JPG tetap JPG. Karena disimpan dengan kualitas tinggi, ukuran file bisa saja masih di atas batas. Itu normal dan akan beres di langkah berikutnya.

## Langkah 2: Kompres sampai pas di bawah batas

1. Buka [Kompres Gambar](/id/tools/image-compress/) dan masukkan foto yang sudah diperkecil.
2. Pada **Format**, pilih **JPEG** jika portal meminta JPG. Pilih **WebP (lebih kecil)** hanya kalau WebP jelas diterima.
3. Biarkan **Kualitas** di 75% (bawaan), lalu klik **Kompres**.
4. Lihat baris **Hasil**. Di situ tertera ukuran baru dan berapa persen lebih kecil dari aslinya.
5. Kalau masih kebesaran, turunkan slider 5–10 poin lalu klik **Kompres** lagi. Kalau ternyata jauh di bawah batas, naikkan kualitasnya supaya foto lebih tajam.
6. Setelah ukurannya pas, klik tombol **Unduh** di bawah pratinjau.

Slider kualitas berkisar 10% sampai 100%. Pada wajah atau tulisan, kotak-kotak kasar biasanya mulai terlihat di bawah kira-kira 50–60%. Kalau Anda terpaksa turun sejauh itu, lebih baik kembali ke Langkah 1 dan perkecil resolusinya lagi. Foto yang lebih kecil dengan kualitas baik tampak lebih rapi daripada foto besar yang pecah.

## Mau sekali jalan? Pakai target ukuran

Kalau yang penting file pasti di bawah angka tertentu, coba tool [Kompres ke Ukuran](/id/tools/compress-to-size/). Pilih preset **200 KB** atau **500 KB** (atau isi angka sendiri), pilih **JPEG** pada format gambar, lalu klik **Kompres**. Tool ini mencari kualitas tertinggi yang masih muat, dan baru memperkecil resolusi kalau kualitas saja tidak cukup. Kalau targetnya mustahil dicapai, Anda akan diberi tahu dan tetap mendapat versi terkecil yang bisa dibuat.

## Tips dan jebakan yang sering terjadi

- **Sisakan ruang.** Tool ini menghitung 1 KB = 1.024 byte, jadi "200 KB" sama dengan 204.800 byte. Portal yang menghitung 1 KB = 1.000 byte akan membaca file yang sama sekitar 205 KB, alias lewat batas. Untuk batas 200 KB, targetkan sekitar 190 KB.
- **PNG transparan jadi berlatar putih.** JPEG tidak mendukung transparansi, jadi area transparan otomatis diisi putih saat Anda memilih JPEG.
- **Butuh pas foto latar merah atau biru untuk dicetak?** Gunakan [Pas Foto Maker](/id/tools/pas-foto/). Hasilnya PDF siap cetak ukuran 2x3, 3x4, atau 4x6.
- **Foto HEIC dari iPhone** yang gagal dibuka bisa diubah dulu dengan tool HEIC ke JPG.
- **Data lokasi ikut terhapus.** Karena file disusun ulang, metadata EXIF dari HP (termasuk lokasi GPS) tidak ikut terbawa. Ini bagus untuk dokumen yang dikirim ke pihak lain.
- **Jangan kompres berulang-ulang.** Setiap kali disimpan ulang sebagai JPEG, detail foto berkurang sedikit. Mulailah selalu dari foto asli atau hasil resize, lalu geser slidernya. Jangan mengompres hasil kompresan.

Foto Anda diproses di browser dan tidak diunggah ke server GoodWebTools. Ini penting kalau file itu berupa KTP, KK, atau ijazah.

## FAQ

### Kenapa foto saya masih di atas 200 KB padahal kualitasnya sudah rendah?

Kemungkinan besar resolusinya masih terlalu besar. Foto HP beresolusi penuh menyimpan banyak detail meski kualitasnya diturunkan. Perkecil dulu ke sekitar 1000–1200 px di sisi terpanjang, baru kompres.

### Apakah portal CPNS atau sekolah menerima file WebP?

Hanya kalau WebP tercantum di daftar format yang diterima. Umumnya yang diminta JPG/JPEG, kadang PNG. Supaya aman, pilih **JPEG** di tool kompres.

### Di tool tertulis 199 KB, kenapa portal bilang kebesaran?

Portal mungkin menghitung 1 KB sebagai 1.000 byte, bukan 1.024, sehingga file Anda terbaca sedikit lebih besar. Kompres ulang dengan ruang lebih lega, misalnya ke 185–190 KB.

### Apakah kompres mengubah ukuran piksel foto?

Tidak. Kompres Gambar mempertahankan lebar dan tinggi. Pengecualiannya: kalau gambar melebihi batas canvas browser, tool akan memperkecilnya dan memberi tahu Anda. Untuk mengubah ukuran piksel, gunakan Pengubah Ukuran Gambar.

### Bisa dilakukan lewat HP?

Bisa. Tool ini berjalan di browser HP. Ketuk kotak unggah untuk memilih foto dari galeri, lalu tekan tombol unduh untuk menyimpan hasilnya.
