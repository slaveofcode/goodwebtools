---
title: "Cara Menggabungkan File PDF Jadi Satu dengan Urutan yang Benar"
description: "Satukan beberapa PDF jadi satu file untuk berkas lamaran, CPNS, atau beasiswa, atur urutannya, rapikan halamannya, dan jaga ukurannya tetap kecil."
tool: pdf-merge
related: [pdf-organize, pdf-split, pdf-compress]
updated: 2026-11-16
---

Banyak formulir pendaftaran meminta "semua dokumen pendukung dalam satu file PDF": surat lamaran, CV, scan ijazah, transkrip, KTP, dan surat pernyataan. Padahal dokumennya terpisah-pisah, ada yang dari Word, ada yang hasil scan di fotokopian, ada yang difoto pakai HP. Menggabungkannya menjadi satu PDF membuat berkas Anda rapi dan urutannya sesuai yang diminta panitia.

Panduan ini memakai tool [Gabung PDF](/id/tools/pdf-merge/) dan menjelaskan cara menangani masalah yang sering muncul: urutan halaman salah, halaman yang tidak perlu ikut masuk, foto yang belum berbentuk PDF, dan file gabungan yang kebesaran.

## Siapkan dulu bahan-bahannya

Persiapan beberapa menit bisa menghemat waktu mengulang:

- **Ubah foto atau scan JPG jadi PDF.** Tool gabung hanya menerima PDF. Kalau scan KTP atau ijazah Anda masih berupa JPG, ubah dulu dengan [Gambar ke PDF](/id/tools/images-to-pdf/).
- **Buang halaman yang tidak diperlukan.** Kalau ada dokumen dengan halaman kosong atau halaman petunjuk, ambil halaman yang perlu saja dengan [Pisah PDF](/id/tools/pdf-split/).
- **Luruskan scan yang miring arahnya.** Halaman yang tersimpan menyamping akan tetap menyamping setelah digabung. Putar dulu dengan [Rotasi PDF](/id/tools/pdf-rotate/).
- **Beri nama berurutan.** Nama seperti `01-surat-lamaran.pdf`, `02-cv.pdf`, `03-ijazah.pdf` memudahkan pengecekan daftar sebelum digabung.

## Langkah-langkah menggabungkan PDF

1. Buka [Gabung PDF](/id/tools/pdf-merge/).
2. Letakkan semua PDF ke kotak, atau klik untuk memilih beberapa file sekaligus. Anda bisa menambah file lagi nanti. Setiap tambahan masuk ke urutan paling bawah.
3. Periksa daftar bernomor. Gunakan tombol panah **Naikkan** dan **Turunkan** di samping file untuk memindahkannya, dan **✕** (Hapus) untuk membuang file yang salah masuk.
4. Klik tombol **Gabungkan N PDF** (N adalah jumlah file di daftar). Minimal harus ada dua file.
5. Gulir pratinjaunya dan pastikan setiap dokumen dimulai di tempat yang benar.
6. Klik **Unduh merged.pdf**, lalu ganti namanya sesuai permintaan panitia, misalnya `NamaLengkap_Berkas.pdf`.

Urutan daftar adalah urutan dokumen akhir: semua halaman file nomor 1 di depan, lalu semua halaman file nomor 2, dan seterusnya.

## Menyusun ulang halaman satu per satu

Tool gabung mengatur urutan per file, bukan per halaman. Kalau Anda perlu memindahkan satu halaman, misalnya halaman bertanda tangan harus langsung setelah halaman depan, buka file gabungan di [Organize PDF](/id/tools/pdf-organize/):

1. Masukkan `merged.pdf`. Semua halaman tampil sebagai thumbnail.
2. Seret thumbnail ke urutan yang diinginkan, dan klik **✕** pada halaman yang ingin dihapus.
3. Bila perlu, centang **Tambahkan nomor halaman**, lalu pilih **Posisi** dan **Mulai dari**. Ini berguna kalau verifikator perlu merujuk "halaman 7 berkas Anda".
4. Klik **Terapkan & unduh**.

Pisah PDF juga bisa dipakai untuk menyusun ulang, karena halaman diekstrak persis sesuai urutan yang Anda ketik. Misalnya `1, 4, 2-3` memindahkan halaman 4 ke posisi kedua, dan `5-1` membalik urutan file lima halaman.

## Jaga ukuran file gabungan

Penggabungan tidak mengompres apa pun, jadi ukuran hasilnya kira-kira jumlah ukuran semua file. Tiga scan masing-masing 2 MB menghasilkan sekitar 6 MB. Kalau melewati batas unggah, kompres hasilnya dengan [Kompres PDF](/id/tools/pdf-compress/). Untuk batas yang ketat seperti 1 MB, gunakan [Kompres ke Ukuran](/id/tools/compress-to-size/). Sering kali lebih baik mengompres scan yang besar terlebih dahulu, baru digabung, supaya dokumen teks yang kecil tidak ikut diubah.

## Hal yang perlu diwaspadai

- **Bookmark.** Halaman disalin ke dokumen baru, jadi panel bookmark (outline) dari file asli tidak ikut terbawa.
- **Formulir isian.** Isi dan simpan dulu formulirnya sebelum digabung, karena kolom isian interaktif bisa jadi tidak berfungsi lagi di file gabungan.
- **PDF berpassword.** PDF yang terkunci bisa gagal dibuka. Hapus passwordnya dulu dengan [Buka Kunci PDF](/id/tools/pdf-unlock/), kalau Anda tahu passwordnya.
- **Jumlah file sangat banyak.** Semua proses berjalan di memori perangkat. Puluhan scan besar bisa lambat di HP lama, jadi lebih nyaman dikerjakan di laptop.

File Anda digabung di dalam browser dan tidak diunggah ke mana pun, sehingga aman untuk kontrak, rekam medis, maupun dokumen identitas.

## FAQ

### Bagaimana cara mengubah urutan file sebelum digabung?

Gunakan tombol panah naik dan turun di samping setiap file pada daftar bernomor. Angka di sebelah kiri adalah posisinya di PDF akhir.

### Bisakah menggabungkan hanya beberapa halaman dari satu PDF?

Bisa. Ambil dulu halaman yang Anda perlukan dengan Pisah PDF (misalnya `2-4`), lalu gabungkan file hasil ekstrak itu dengan file lainnya.

### Bisakah memasukkan JPG atau PNG langsung?

Tidak langsung, karena tool gabung hanya menerima PDF. Ubah gambar dengan Gambar ke PDF dulu, lalu tambahkan PDF-nya ke daftar.

### Kenapa PDF gabungannya besar sekali?

Penggabungan mempertahankan setiap halaman apa adanya, jadi ukurannya terjumlah. Kompres file gabungannya, atau kompres scan terbesar sebelum digabung.

### Apakah ada batas jumlah file?

Tidak ada batas tetap, tetapi minimal dua file. Gabungan yang sangat besar bergantung pada memori perangkat. Kalau gagal, gabungkan dalam dua tahap, lalu gabungkan kedua hasilnya.
