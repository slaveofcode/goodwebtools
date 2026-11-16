---
title: "Cara Memberi Watermark pada Foto KTP Sebelum Dikirim"
description: "Bubuhkan keperluan dan tanggal di foto KTP, lalu tutup data yang tidak diperlukan penerima, agar salinan yang bocor sulit disalahgunakan."
tool: image-watermark
related: [image-annotate, image-crop, image-face-blur]
updated: 2026-11-16
---

Foto KTP diminta di banyak tempat: pemilik kos, rental motor, penjual COD di marketplace, HRD saat melamar kerja, sampai panitia acara. Begitu terkirim, Anda tidak bisa mengendalikan ke mana foto itu beredar. Salinan KTP yang bersih tanpa tanda bisa disimpan dan dipakai ulang, misalnya untuk mendaftar akun atau pinjaman online atas nama Anda. Watermark memang tidak membuat penyalahgunaan mustahil. Tetapi salinan yang jelas-jelas bertuliskan untuk siapa dan kapan dibuat jauh kurang berguna bagi orang lain, dan lebih mudah dikenali kalau disalahgunakan.

Panduan ini terdiri dari tiga langkah: memotong foto agar hanya berisi kartunya, membubuhkan watermark berisi keperluan, lalu menutup data yang tidak dibutuhkan penerima. Semua tool yang dipakai berjalan di browser.

## Langkah 1: Potong foto agar hanya berisi kartu

Foto KTP dari HP biasanya ikut memuat meja, jari, atau dokumen lain. Buang dulu bagian itu.

1. Buka [Pemotong Gambar](/id/tools/image-crop/), lalu masukkan fotonya.
2. Seret kotak crop ke atas kartu dan ubah ukurannya lewat sudut-sudutnya. Sisakan sedikit ruang di tepi kartu.
3. Klik **Potong**, lalu unduh hasilnya.

Kalau KTP difoto miring, luruskan dulu dengan [Luruskan & Potong Scan](/id/tools/scan-deskew/) supaya baris tulisannya rata.

## Langkah 2: Bubuhkan watermark berisi keperluan

Watermark yang baik untuk KTP menjawab tiga hal: **untuk siapa**, **untuk keperluan apa**, dan **kapan**. Contohnya:

`HANYA UNTUK SEWA KOS JL. MAWAR 12 - 16/11/2026`

atau, untuk transaksi online:

`KHUSUS VERIFIKASI TOKO XYZ - 16 NOV 2026`

Lalu:

1. Buka [Watermark Gambar](/id/tools/image-watermark/) dan masukkan foto yang sudah dipotong. Anda juga bisa menempelnya dengan ⌘V / Ctrl+V.
2. Ganti isi kolom **Teks watermark**. Isi awalnya "© GoodWebTools", jadi hapus dulu lalu ketik kalimat Anda. Kolom ini hanya satu baris, jadi buat teks yang ringkas.
3. Di **Tata letak**, pilih **Ubin**. Teks diulang miring ke seluruh bagian kartu, sehingga memotong satu sudut foto tidak akan menghilangkannya. **Diagonal** hanya menaruh satu baris di tengah, sedangkan **Sudut** menaruh satu cap di kanan bawah yang gampang dipotong. Untuk salinan KTP, Ubin adalah pilihan paling kuat.
4. Turunkan **Skala**. Ukuran huruf dihitung dari sisi gambar yang lebih pendek, jadi kalimat panjang pada nilai awal 30% akan terlihat besar sekali. Kisaran 10–20% biasanya membuat tiap baris muat tetapi tetap terbaca.
5. Atur **Opasitas** agar isi KTP tetap terbaca. Slider bergerak dari 10% sampai 100%. Kisaran 35–50% biasanya sudah cukup mencolok tanpa menutupi data yang perlu dicek penerima.
6. Pilih **Warna** yang kontras dengan kartu. Abu-abu bawaan bisa tenggelam di latar biru muda KTP, jadi warna gelap seperti merah tua atau biru dongker sering lebih jelas.
7. Klik **Tambah watermark** dan periksa pratinjaunya. Kalau terlalu besar atau terlalu samar, ubah pengaturannya lalu klik **Tambah watermark** lagi. Setiap proses selalu dimulai dari foto asli, bukan dari hasil sebelumnya, jadi watermark tidak akan menumpuk.

Hasil unduhan mempertahankan format aslinya: JPG tetap JPG, PNG tetap PNG, dan nama file mendapat tambahan "-watermarked".

## Langkah 3: Tutup data yang tidak diperlukan

Tanyakan dulu, sebenarnya data apa yang perlu dicek penerima. Pemilik kos mungkin cukup melihat nama dan wajah. Penjual COD mungkin hanya perlu nama. Tutup sisanya, biasanya alamat lengkap, tanggal lahir, tanda tangan, atau sebagian NIK, kecuali penerima memang menyatakan data itu wajib.

Anda bisa langsung melakukannya dari hasil watermark:

1. Di bawah pratinjau, klik **Edit di Anotator**. Gambar yang sudah diberi watermark terbuka di [Anotator Gambar](/id/tools/image-annotate/).
2. Untuk penutup paling aman, pilih **Pensil**, atur **Warna** ke hitam, naikkan **Tebal** sampai maksimal, lalu sapukan beberapa kali dengan goresan yang saling tumpang tindih sampai tidak ada angka yang tembus.
3. **Blur** lebih cepat (cukup seret kotak di atas area), tetapi blur bukan jaminan. Angka besar yang kontras kadang masih bisa ditebak. Untuk NIK, pakai goresan solid.
4. Jangan pakai **Penyorot** atau **Persegi panjang** untuk menyembunyikan tulisan. Penyorot bersifat transparan, dan persegi panjang hanya berupa garis tepi tanpa isi.
5. Klik **Unduh PNG**.

Kalau foto wajah di KTP tidak diperlukan, misalnya ketika Anda hanya perlu membuktikan alamat, proses gambarnya dengan [Blur Wajah](/id/tools/image-face-blur/) dan pilih efek **Blok**. Tool tersebut sendiri mengingatkan bahwa blur dan piksel bisa sebagian dipulihkan, jadi Blok adalah pilihan yang aman.

## Tips dan hal yang sering terlewat

- **Watermark dulu, baru tutup data.** Kalau urutannya dibalik, teks Ubin akan melintas di atas goresan hitam Anda. Tidak berbahaya, hanya terlihat kurang rapi.
- **Simpan foto KTP asli hanya untuk Anda.** Buat salinan baru untuk setiap penerima, lengkap dengan nama penerima dan tanggalnya. Kalau satu salinan bocor, Anda tahu asalnya.
- **Cek ukuran file sebelum mengunggah.** Anotator menyimpan dalam format PNG, yang bisa beberapa kali lebih besar daripada JPG. Kalau formulir membatasi ukuran file, kompres hasil akhirnya.
- **Perbesar hasilnya** untuk memastikan data yang ditutup benar-benar hilang dan data yang dibutuhkan masih terbaca.
- **Jangan beri watermark kalau diminta salinan tanpa perubahan.** Ada proses resmi yang mensyaratkan scan asli. Kalau ragu, tanyakan dulu ke instansinya sebelum mengirim salinan yang sudah diubah.

Gambar diolah di kanvas di dalam tab browser Anda, sehingga foto KTP tidak diunggah ke mana pun selama Anda mengeditnya.

## FAQ

### Apakah watermark bisa mencegah KTP saya disalahgunakan?

Tidak sepenuhnya, karena orang yang niat bisa mencoba menghapusnya. Tetapi watermark Ubin yang melintasi data penting membuat hal itu jauh lebih sulit, dan penyalahgunaan lebih mudah ketahuan, apalagi kalau teksnya menyebut penerima dan tanggal.

### Sebaiknya saya menulis apa di watermark?

Sebutkan penerima, keperluan, dan tanggal, misalnya "HANYA UNTUK SEWA MOTOR ABC - 16/11/2026". Hindari teks umum seperti "COPY", karena tidak menjelaskan ke mana salinan itu seharusnya dikirim.

### Apakah blur cukup untuk menyembunyikan NIK?

Untuk tulisan kecil, blur mungkin cukup, tetapi tidak dijamin. Untuk data sensitif seperti NIK, tutup dengan goresan hitam solid memakai Pensil. Untuk foto wajah, pakai efek Blok di Blur Wajah.
