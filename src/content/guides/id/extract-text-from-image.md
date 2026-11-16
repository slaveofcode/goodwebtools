---
title: "Cara Mengambil Teks dari Gambar, Screenshot, atau Foto Dokumen"
description: "Salin teks dari screenshot, foto dokumen, dan halaman PDF dengan OCR di perangkat, plus trik untuk gambar yang buram, miring, panjang, atau dua kolom."
tool: image-ocr
related: [text-cleanup, scan-deskew, image-crop]
updated: 2026-11-16
---

Teks yang "terkunci" di dalam gambar ada di mana-mana: screenshot pesan error, foto surat edaran RT, hasil scan yang dikirim dalam bentuk PDF, slide presentasi yang difoto saat rapat, atau alamat dan nomor resi di screenshot chat. Mengetik ulang memakan waktu dan rawan salah ketik. OCR (optical character recognition) membaca huruf-huruf itu untuk Anda, sehingga teksnya bisa langsung ditempel ke email, dokumen, atau kolom pencarian.

Panduan ini memakai tool [Gambar ke Teks (OCR)](/id/tools/image-ocr/), yang menjalankan model pengenal teks langsung di browser. Panduan ini juga membahas pengaturan kecil yang menentukan apakah hasilnya rapi atau berantakan.

## Mengambil teks dalam empat langkah

1. Buka [Gambar ke Teks (OCR)](/id/tools/image-ocr/), lalu masukkan gambar atau PDF. Ada tiga cara: letakkan file di kotak, tempel screenshot langsung dari clipboard dengan ⌘V / Ctrl+V, atau klik **Gunakan kamera** lalu **Ambil** untuk memotret halaman. Jika perangkat Anda punya lebih dari satu kamera, **Ganti kamera** bisa dipakai untuk berpindah kamera.
2. Periksa pratinjaunya. Kalau gambarnya miring 90 derajat atau terbalik, klik **Putar 90°** (searah jarum jam setiap kali klik) sampai tulisannya tegak.
3. Klik **Jalankan OCR**. Selama proses, tombol berubah menjadi **Membaca…**. Pada penggunaan pertama, tool juga mengunduh model OCR sekali saja, berukuran beberapa megabyte. Karena itu, proses pertama butuh koneksi internet dan lebih lama.
4. Hasilnya muncul di kotak **Teks yang dikenali** yang bisa diedit. Perbaiki huruf yang salah baca langsung di situ, lalu klik **Salin**, atau **Unduh .txt** untuk menyimpannya sebagai `ocr.txt`.

Untuk PDF beberapa halaman, pakai tombol **Sebelumnya** dan **Berikutnya** untuk memilih halaman (penanda menunjukkan misalnya **Halaman 2 / 5**), lalu jalankan OCR di halaman itu. Setiap halaman dibaca terpisah, jadi ulangi untuk setiap halaman yang Anda perlukan. Kalau ingin mengubah seluruh PDF menjadi dokumen yang bisa diedit sekaligus, [PDF ke Word](/id/tools/pdf-to-docx/) lebih cocok.

## Agar hasilnya lebih bersih

**Potong serapat mungkin.** OCR membaca semua yang terlihat, termasuk jam, ikon baterai, dan tombol aplikasi di screenshot HP. Potong dulu bagian teks yang Anda perlukan dengan [Pemotong Gambar](/id/tools/image-crop/), supaya tidak banyak yang harus dihapus nanti.

**Pecah screenshot yang panjang.** Sebelum dibaca, gambar diperkecil sehingga sisi terpanjangnya maksimal 2000 piksel. Screenshot biasa tidak terpengaruh. Tetapi screenshot panjang (scroll capture) berisi satu percakapan WhatsApp atau satu halaman web akan menyusut sampai hurufnya kecil sekali. Potong menjadi beberapa bagian setinggi satu layar, lalu baca satu per satu.

**Baca satu kolom setiap kali.** Teks disusun dari atas ke bawah, kiri ke kanan, dan kata-kata yang sejajar secara horizontal digabung jadi satu baris. Pada halaman dua kolom, koran, atau tabel, baris dari kolom kiri dan kanan akan tercampur dalam satu baris. Potong tiap kolom secara terpisah.

**Luruskan foto kertas.** Halaman yang difoto dari samping punya baris yang miring dan mengecil, sehingga sulit dibaca. Proses dulu dengan [Luruskan & Potong Scan](/id/tools/scan-deskew/) untuk meratakan perspektifnya.

**Pakai Bersihkan gambar untuk tulisan pudar atau berbayang.** Centang **Bersihkan gambar** untuk mengubah gambar menjadi hitam-putih murni, lalu perhatikan pratinjaunya sambil menggeser slider **Ambang** (0–255, nilai awal 140). Piksel yang lebih gelap dari ambang menjadi hitam, dan sisanya menjadi putih.
- Naikkan ambang jika tulisan tipis atau abu-abu muda terputus-putus atau hilang.
- Turunkan ambang jika latar abu-abu, tekstur kertas, atau bayangan berubah menjadi noda hitam.

Untuk screenshot yang bersih, opsi ini tidak perlu. Screenshot mode gelap (tulisan terang di latar gelap) juga biasanya terbaca baik apa adanya.

**Bagian yang tidak terbaca dilewati, bukan ditebak.** Teks yang tidak bisa dibaca model dengan yakin akan dilewati, bukan diisi huruf acak. Kalau ada kata atau baris yang hilang, biasanya tulisannya terlalu kecil, buram, atau kurang kontras. Perbesar gambar, potong lebih rapat, atau pakai opsi pembersihan.

## Merapikan teks hasil OCR

Setiap baris visual di gambar menjadi satu baris di hasil OCR, jadi paragraf dari kertas cetak akan penuh jeda baris setiap beberapa kata. Tempel teksnya ke [Pembersih Teks](/id/tools/text-cleanup/) dan pakai **Hapus jeda baris (gabung)** untuk menyambungnya kembali menjadi kalimat utuh. Setelah itu, cek karakter yang paling sering tertukar: `0` dan `O`, `1`, `l`, dan `I`, `rn` dan `m`, serta titik dan koma pada angka, misalnya Rp1.250.000 yang bisa terbaca Rp1,250.000. Untuk struk belanja, centang **Uraikan sebagai struk** di bawah hasil untuk mengambil data seperti nama toko dan total.

## Bahasa yang didukung

Tool ini paling akurat untuk teks cetak beraksara Latin, termasuk bahasa Indonesia, Inggris, dan sebagian besar bahasa Eropa. Model yang dipakai juga mencakup aksara lain seperti Mandarin dan Jepang. Tetapi model ini versi ringkas yang dioptimalkan untuk kecepatan, jadi hasil untuk aksara tersebut tidak sekonsisten teks Latin. Tulisan tangan belum bisa diandalkan. Huruf kapital yang rapi mungkin terbaca, tetapi tulisan sambung biasanya tidak.

Pengenalan teks berjalan di perangkat Anda. Jika browser mendukung WebGPU, tool memakainya. Jika tidak, tool beralih ke mode CPU yang lebih lambat dan menampilkan catatan soal itu. Dalam kedua mode, gambarnya tidak diunggah.

## FAQ

### Kenapa muncul pesan "No text detected"?

Artinya model tidak menemukan tulisan yang bisa dibaca dengan yakin. Pastikan gambar dalam posisi tegak (pakai **Putar 90°**), potong lebih dekat ke tulisannya, dan coba **Bersihkan gambar** dengan nilai ambang yang berbeda. Penyebab paling umum adalah tulisan yang sangat kecil di foto yang besar.

### Bisakah membaca teks dari PDF?

Bisa. Masukkan PDF, pilih halaman dengan **Sebelumnya** dan **Berikutnya**, lalu klik **Jalankan OCR**. Cara ini juga berlaku untuk PDF hasil scan. Untuk PDF digital, teksnya biasanya bisa langsung diblok dan disalin tanpa OCR.

### Apakah bisa dipakai tanpa internet?

Setelah berhasil dijalankan sekali, model disimpan oleh browser, sehingga penggunaan berikutnya tidak perlu mengunduhnya lagi. Penggunaan pertama tetap butuh koneksi internet untuk mengambil modelnya.

### Kenapa prosesnya lambat di komputer saya?

Jika browser Anda tidak mendukung WebGPU, pengenalan teks berjalan di CPU, yang terasa lebih lambat, terutama untuk foto berukuran besar. Memotong gambar agar hanya berisi teks yang diperlukan juga mengurangi beban kerjanya.
