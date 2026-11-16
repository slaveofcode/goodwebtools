---
title: "Cara Mengubah Foto HEIC iPhone ke JPG di Windows atau Browser"
description: "Ubah foto .HEIC dari iPhone menjadi JPG agar bisa dibuka di Windows dan diunggah ke formulir online, sekaligus banyak file dan ukuran tetap terkendali."
tool: image-heic-to-jpg
related: [image-compress, compress-to-size, image-resize]
updated: 2026-11-16
---

Secara bawaan, iPhone menyimpan foto dalam format HEIC (`.heic`, kadang `.heif`). Formatnya hemat ruang, tetapi masih banyak software yang belum bisa membacanya. Kasusnya sering begini: Anda memindahkan foto dari iPhone ke laptop Windows lewat kabel, mengunduhnya dari iCloud, atau menerima foto dari teman sebagai dokumen. Hasilnya, folder Anda penuh file `IMG_1234.HEIC`. Aplikasi Foto di Windows menolak membukanya, editor lama hanya menampilkan ikon kosong, dan formulir pendaftaran atau lamaran kerja yang menulis "format JPG/PNG" langsung menolak file tersebut.

Jalan keluarnya adalah mengubah foto ke JPG, karena JPG bisa dibuka hampir di mana saja. Panduan ini memakai tool [HEIC ke JPG](/id/tools/image-heic-to-jpg/). Foto diproses langsung di browser, jadi tool ini jalan di Windows, Linux, Chromebook, maupun Android tanpa perlu memasang aplikasi.

## Mengonversi satu foto atau satu folder sekaligus

1. Buka [HEIC ke JPG](/id/tools/image-heic-to-jpg/), lalu letakkan foto di kotak bertuliskan **Letakkan foto HEIC atau klik untuk memilih**. Anda bisa memilih banyak file sekaligus. Tekan Ctrl+A di jendela pemilih file untuk mengambil satu folder penuh.
2. Perhatikan keterangan di bawah kotak, yang menunjukkan jumlah file yang diterima. File yang bukan HEIC/HEIF, misalnya `.MOV` dari Live Photo atau JPG yang sudah jadi, akan dilewati dan tool memberi tahu berapa file non-HEIC yang diabaikan.
3. Atur slider **Kualitas JPG**. Rentangnya 50% sampai 100%, dengan nilai awal 92%. Di layar, hasil 92% praktis tidak bisa dibedakan dari aslinya.
4. Klik **Konversi ke JPG**. Kalau Anda memasukkan banyak foto, tombolnya berubah menjadi misalnya **Konversi 12 foto ke JPG**. Bilah progres menghitung foto yang sudah selesai.
5. Setiap hasil tampil dengan pratinjau dan ukuran file barunya. Unduh satu per satu lewat tombol **Unduh**, atau klik **Unduh semua sebagai ZIP** untuk mendapatkan semuanya dalam satu file `heic-to-jpg.zip`.

Nama file tetap sama, hanya ekstensinya yang berganti: `IMG_1234.HEIC` menjadi `IMG_1234.jpg`. Jika ada dua file yang hasilnya bernama sama, file kedua diberi nama `IMG_1234 (2).jpg` supaya tidak saling menimpa di dalam ZIP.

Jika ada file yang rusak atau ternyata bukan HEIC sungguhan, muncul pesan merah **Tidak dapat mengonversi …** untuk file itu saja, dan foto lain tetap diproses.

## Memilih kualitas yang pas

Di bagian hasil, setiap JPG ditampilkan bersama ukuran dan persentase perubahannya. Angka hijau "lebih kecil" berarti JPG lebih ringan daripada HEIC aslinya. Angka merah "lebih besar" berarti JPG justru lebih berat. JPG yang lebih besar itu wajar, karena HEIC memang lebih efisien. Pada kualitas 92%, JPG sering kali lebih besar daripada file awalnya.

Gunakan angka itu sebagai patokan:

- **Untuk arsip atau cetak foto**, biarkan kualitas di 90–100%. Foto jadi bisa dibuka di mana saja, dan detailnya hampir tidak berkurang.
- **Untuk dikirim lewat email atau WhatsApp sebagai dokumen**, kualitas sekitar 80% biasanya menghasilkan file yang jauh lebih kecil tanpa penurunan yang terlihat di layar HP atau laptop.
- **Untuk formulir dengan batas ukuran ketat**, misalnya maksimal 500 KB, menurunkan kualitas saja sering tidak cukup untuk foto 12 megapiksel. Konversi dulu, lalu pakai [Kompres ke Ukuran](/id/tools/compress-to-size/) untuk mengejar target ukuran yang pasti, atau [Pengubah Ukuran Gambar](/id/tools/image-resize/) untuk memperkecil dimensi piksel.

Jangan mengonversi ulang foto yang sama berkali-kali dengan kualitas rendah, karena setiap kali disimpan sebagai JPG, sedikit detail ikut hilang. Kalau butuh pengaturan lain, mulai lagi dari file HEIC aslinya.

## Yang perlu diketahui sebelum menghapus file asli

**Info foto tidak ikut terbawa.** Tool ini membaca gambarnya lalu menyimpan JPG baru, sehingga data EXIF di dalam file tidak disalin. Data itu mencakup tanggal pengambilan, model kamera, dan lokasi GPS kalau layanan lokasi aktif. Ini menguntungkan ketika Anda mengirim foto ke orang lain dan tidak ingin lokasi rumah Anda ikut tersimpan di file. Sebaliknya, ini merugikan kalau Anda mengandalkan "tanggal diambil" untuk mengurutkan arsip, karena JPG hasil konversi akan diurutkan berdasarkan tanggal file. Simpan file HEIC aslinya jika data itu penting.

**Hanya gambar diam yang dikonversi.** Satu file HEIC berisi satu gambar utama, dan gambar itulah yang Anda dapatkan. Bagian bergerak dari Live Photo tersimpan sebagai file `.MOV` terpisah dan diabaikan oleh tool ini.

**Batch besar butuh waktu.** Foto dibaca satu per satu di perangkat Anda sendiri. Biarkan tab tetap terbuka sampai bilah progres selesai.

## Cegah masalahnya sejak dari iPhone

Kalau Anda sering memindahkan foto ke PC Windows, dua pengaturan iPhone ini membantu:

- **Pengaturan > Kamera > Format > Paling Kompatibel** membuat kamera memotret dalam JPG untuk seterusnya. File akan lebih besar, dan beberapa mode rekam video hanya tersedia jika pilihan Efisiensi Tinggi aktif.
- Di pengaturan **Foto**, bagian **Transfer ke Mac atau PC**, pilih **Otomatis**. iPhone akan mengubah foto ke format yang kompatibel saat disalin lewat kabel.

Kedua pengaturan ini tidak mengubah foto yang sudah terlanjur diambil, dan tidak membantu ketika orang lain mengirimi Anda file HEIC. Jadi tool konversi tetap berguna.

Foto Anda dibaca oleh kode WebAssembly yang berjalan di dalam tab browser, dan tidak dikirim ke server selama proses konversi.

## FAQ

### Kenapa Windows tidak bisa membuka file HEIC saya?

Windows butuh ekstensi codec tambahan dari Microsoft Store untuk menampilkan foto HEIC, dan banyak PC belum memasangnya. Dengan mengubah foto ke JPG, Anda tidak perlu ekstensi apa pun, dan fotonya juga bisa dibuka di PC lama atau di komputer orang lain.

### Kenapa file JPG saya lebih besar daripada HEIC aslinya?

HEIC menyimpan gambar yang sama dengan jumlah byte yang lebih sedikit. Pada kualitas tinggi, JPG bisa lebih besar. Turunkan slider **Kualitas JPG** ke sekitar 80%, atau kompres hasilnya, kalau ukuran file lebih penting daripada detail yang sempurna.

### Apakah JPG hasil konversi masih menyimpan lokasi foto?

Tidak. JPG dibuat ulang tanpa metadata EXIF aslinya, jadi lokasi GPS, tanggal pengambilan, dan info kamera tidak ikut tersimpan. Simpan file HEIC jika Anda masih membutuhkan informasi tersebut.

### Bisakah JPG diubah kembali ke HEIC?

Tidak dengan tool ini, karena tool ini hanya mengonversi satu arah, dari HEIC/HEIF ke JPG. Untuk konversi antara JPG, PNG, dan WebP, gunakan [Konverter Gambar](/id/tools/image-convert/).
