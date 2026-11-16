---
title: "Cara Memperkecil Ukuran PDF Tanpa Merusak Teksnya"
description: "Kecilkan PDF untuk email atau unggahan CPNS, beasiswa, dan lamaran kerja: kapan kompres biasa cukup, dan apa yang dilakukan kalau masih kebesaran."
tool: pdf-compress
related: [compress-to-size, pdf-split, images-to-pdf]
updated: 2026-11-16
---

Contohnya: scan ijazah, transkrip, dan surat pernyataan sudah digabung jadi satu PDF, tetapi portal pendaftaran menolaknya karena melebihi batas, misalnya maksimal 1 MB. Atau lampiran email lamaran kerja gagal terkirim karena terlalu besar.

Seberapa banyak PDF bisa diperkecil sangat bergantung pada isinya. Laporan 40 halaman yang berisi teks biasanya sudah kecil. Sebaliknya, lima lembar hasil scan beresolusi tinggi, atau dokumen Word yang penuh foto dari HP, bisa berukuran belasan MB. Panduan ini dimulai dengan tool [Kompres PDF](/id/tools/pdf-compress/) yang menjaga isi dokumen tetap utuh, lalu membahas apa yang bisa dilakukan kalau cara itu belum cukup.

## Apa yang sebenarnya dilakukan Kompres PDF

Tool ini menyimpan ulang PDF Anda dengan kompresi bawaan mesin PDF yang diaktifkan. Stream halaman, gambar, dan font yang tadinya tersimpan tanpa kompresi dipadatkan, dan objek yang sudah tidak terpakai (misalnya sisa dari editan sebelumnya) dibuang. Teks tetap berupa teks asli yang bisa diseleksi dan dicari, dan resolusi gambar tidak diturunkan.

Karena itu, hasilnya paling terasa pada PDF yang disimpan secara boros. Kalau gambar di dalamnya sudah berupa JPEG terkompres, hampir tidak ada yang bisa dipangkas. Tool ini akan memberi tahu Anda, bukan memberikan file yang lebih jelek.

## Langkah-langkah mengompres PDF

1. Buka [Kompres PDF](/id/tools/pdf-compress/), lalu letakkan file ke kotak atau klik untuk memilih.
2. Pastikan nama file dan ukuran aslinya muncul di bawah kotak.
3. Klik **Kompres PDF**. File besar butuh beberapa detik, dan penggunaan pertama juga memuat mesin PDF.
4. Lihat baris **Hasil**: ukuran baru beserta persentasenya, misalnya "−35% lebih kecil".
5. Gulir pratinjaunya dan pastikan semua halaman tampil benar.
6. Klik **Unduh compressed.pdf**. Ganti nama filenya kalau portal meminta format nama tertentu (misalnya `NIK_Ijazah.pdf`).

Kalau yang muncul **sudah optimal** disertai keterangan bahwa PDF "sudah terkompres dengan baik", berarti kompresi tanpa mengurangi kualitas sudah mentok. Lanjutkan ke salah satu opsi di bawah.

## Kalau masih terlalu besar

### Opsi 1: Kompres ke ukuran target

Untuk batas yang pasti, seperti "PDF maksimal 500 KB" di formulir CPNS atau beasiswa, gunakan [Kompres ke Ukuran](/id/tools/compress-to-size/). Masukkan PDF, pilih preset (**200 KB**, **500 KB**, **1 MB**, **2 MB**) atau isi angka sendiri, lalu klik **Kompres**.

Tool ini mencoba kompresi lossless lebih dulu. Kalau masih di atas target, setiap halaman digambar ulang menjadi gambar dengan resolusi dan kualitas JPEG yang makin rendah sampai filenya muat. Hasilnya bisa jauh lebih kecil, tetapi ada konsekuensinya: tool akan menampilkan catatan bahwa **teks tidak lagi bisa diseleksi**. Untuk scan sertifikat biasanya tidak masalah. Untuk CV yang mungkin dibaca sistem rekrutmen, sebaiknya hindari. Perbesar pratinjau dan pastikan tulisan kecil seperti nomor seri ijazah masih terbaca.

### Opsi 2: Buang halaman yang tidak perlu

Sering ada halaman yang tidak diminta, seperti scan kosong, sampul, atau lampiran tambahan. Gunakan [Pisah PDF](/id/tools/pdf-split/) untuk menyisakan halaman yang perlu saja: isi **Halaman yang akan diekstrak** (misalnya `1-3, 5`), klik **Ekstrak halaman**, lalu unduh file barunya.

### Opsi 3: Kirim terpisah

Kalau penerima menerima beberapa lampiran, atau formulir menyediakan kolom unggah terpisah, pecah dokumen besar dengan Pisah PDF (misalnya `1-10`, lalu `11-20`) dan kompres tiap bagian.

### Opsi 4: Susun ulang scan dari gambar yang lebih kecil

Kalau PDF Anda berasal dari foto HP atau hasil scan, sering lebih efektif mulai lagi dari gambarnya. Perkecil dulu gambarnya (lebar sekitar 1200–1600 px masih cukup untuk halaman A4), lalu gabungkan dengan [Gambar ke PDF](/id/tools/images-to-pdf/). Dengan cara ini Anda yang menentukan resolusinya, hal yang tidak bisa dilakukan kompresi lossless.

## Tips dan jebakan

- **Perhatikan satuan batasnya.** Tool kami menghitung 1 KB = 1.024 byte, sedangkan sebagian portal memakai 1.000. Targetkan beberapa persen di bawah batas yang tertulis.
- **Mengompres dua kali tidak ada gunanya.** Menjalankan Kompres PDF pada hasilnya sendiri tidak akan memangkas apa-apa lagi.
- **Atur scanner dengan wajar.** Untuk dokumen teks, 150–200 DPI skala abu-abu biasanya sudah terbaca jelas, dan ukurannya jauh lebih kecil daripada 600 DPI berwarna. Ini juga berlaku untuk aplikasi scan di HP yang punya pengaturan kualitas.
- **PDF berpassword.** Kalau PDF terkunci tidak bisa dibuka, hapus dulu passwordnya dengan [Buka Kunci PDF](/id/tools/pdf-unlock/) (Anda harus tahu passwordnya).
- **Simpan file aslinya.** Terutama setelah kompres ke ukuran target yang mengubah teks menjadi gambar.

PDF Anda diproses di dalam browser dan tidak pernah diunggah, jadi aman untuk slip gaji, kontrak, atau scan KTP.

## FAQ

### Kenapa PDF saya hampir tidak mengecil?

Kemungkinan besar file itu sudah terkompres. Sebagian besar ukurannya berasal dari gambar JPEG atau font tertanam yang tidak bisa dipangkas tanpa mengurangi kualitas. Untuk memperkecil lagi, resolusi gambarnya harus diturunkan. Itulah yang dilakukan Kompres ke Ukuran dengan menggambar ulang halaman.

### Apakah Kompres PDF menurunkan kualitas?

Tidak. Teks tetap bisa diseleksi dan gambar tidak diturunkan resolusinya. Itu juga alasan tool ini tidak selalu bisa memperkecil semua file.

### Bagaimana cara membuat PDF di bawah 1 MB atau 500 KB?

Gunakan Kompres ke Ukuran dengan preset yang sesuai. Kalau versi terkecilnya pun masih di atas batas, buang halaman yang tidak perlu dengan Pisah PDF, atau susun ulang scan dari gambar yang lebih kecil.

### Apakah teks di PDF hasil kompres masih bisa dicari?

Setelah Kompres PDF, ya. Setelah Kompres ke Ukuran, hanya kalau tahap lossless sudah cukup. Kalau muncul catatan bahwa halaman diratakan menjadi gambar, teksnya tidak bisa lagi diseleksi atau dicari.

### Apakah ada batas ukuran file?

Tidak ada batas tetap. PDF yang sangat besar bergantung pada memori perangkat, jadi laptop sanggup menangani file lebih besar daripada HP lama. Kalau file raksasa gagal diproses, pecah dulu menjadi beberapa bagian.
