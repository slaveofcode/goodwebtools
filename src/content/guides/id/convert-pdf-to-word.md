---
title: "Cara Mengubah PDF ke Word agar Bisa Diedit"
description: "Ubah PDF, termasuk hasil scan, menjadi .docx yang bisa diedit di Word, lalu rapikan tabel, kolom, judul, dan tanda hubung yang tersisa."
tool: pdf-to-docx
related: [image-ocr, pdf-unlock, pdf-extract-images]
updated: 2026-11-16
---

Anda menerima surat perjanjian, formulir, atau laporan dalam bentuk PDF dan hanya perlu mengubah beberapa paragraf. Mengetik ulang jelas makan waktu, sedangkan menyalin teks langsung dari PDF biasanya menghasilkan baris-baris terputus yang harus disambung satu per satu. Dengan mengubah PDF ke Word, Anda mendapatkan paragraf sungguhan yang bisa diedit, diberi gaya baru, dan dipakai ulang.

Ada satu hal yang perlu dipahami dulu. PDF tidak menyimpan paragraf, melainkan huruf-huruf di posisi tertentu pada halaman. Setiap konverter harus menebak mana baris, paragraf, judul, dan tabel. Jadi hasilnya adalah susunan ulang teks yang bisa diedit, bukan salinan yang persis sama. Panduan ini menjelaskan cara memakai tool [PDF ke Word (DOCX)](/id/tools/pdf-to-docx/) dan cara merapikan hasilnya dengan cepat.

## Mengonversi PDF

1. Buka [PDF ke Word (DOCX)](/id/tools/pdf-to-docx/).
2. **Tentukan pilihan OCR sebelum memasukkan file.** Konversi langsung berjalan begitu PDF dimasukkan, dan kotak centang dikunci selama proses. Untuk PDF biasa, biarkan **Paksa OCR (PDF hasil pindaian)** tidak dicentang. Kapan perlu dicentang dijelaskan di bagian berikutnya.
3. Letakkan PDF di kotak **Letakkan PDF**, atau klik kotak itu untuk memilih file. Tool ini memproses satu file setiap kali.
4. Perhatikan bilah progres. Untuk tiap halaman, muncul **Membaca teks — halaman 3 dari 12…** (teks diambil langsung dari PDF) atau **Membaca (OCR) — halaman 3 dari 12…** (halaman dibaca sebagai gambar dengan OCR). Langkah terakhirnya **Menyusun dokumen Word…**.
5. File `.docx` terunduh otomatis dengan nama yang sama, misalnya `surat-perjanjian.pdf` menjadi `surat-perjanjian.docx`.

## PDF hasil scan dan kapan perlu Paksa OCR

Tool ini memeriksa setiap halaman. Jika sebuah halaman hampir tidak punya teks yang bisa dipilih (kurang dari delapan karakter), halaman itu dianggap hasil scan. Halaman tersebut dirender dengan resolusi dua kali lipat lalu dibaca dengan OCR di perangkat. PDF campuran, misalnya surat yang diketik ditambah lampiran hasil scan, ditangani per halaman, jadi Anda tidak perlu melakukan apa-apa.

Centang **Paksa OCR (PDF hasil pindaian)** jika:

- **Hasil scan punya sedikit teks tambahan.** Halaman scan yang diberi kop, cap tanggal, atau nomor halaman secara digital punya sedikit teks yang bisa dipilih, sehingga tidak terdeteksi sebagai scan. Hanya teks kecil itu yang terbawa, dan isi utamanya hilang.
- **Teks yang ada ternyata kacau.** Sebagian mesin scanner menambahkan lapisan OCR sendiri yang kualitasnya buruk. Kalau menyalin teks dari PDF menghasilkan huruf acak, Paksa OCR akan membacanya ulang dari awal.

Jangan paksa OCR untuk PDF digital biasa, misalnya hasil ekspor dari Word atau e-statement bank. Pengambilan teks langsung lebih cepat dan lebih akurat, dan hanya jalur ini yang bisa menyusun ulang tabel (halaman OCR disusun sebagai paragraf biasa). Kualitas OCR bergantung pada hasil scan. Scan yang lurus dan terang pada 300 dpi jauh lebih mudah dibaca daripada foto HP dari kertas yang kusut. Penggunaan OCR pertama kali juga mengunduh model pengenal teks sekali, jadi perlu koneksi internet.

## Apa yang Anda dapatkan, dan yang perlu dirapikan di Word

File Word hanya berisi teks yang bisa diedit:

- **Judul.** Baris dengan huruf yang jelas lebih besar dijadikan gaya **Heading 1** atau **Heading 2** asli milik Word. Aktifkan **View > Navigation Pane** untuk melihat kerangka dokumen dan melompat antarbagian. Jika ada judul yang terlewat atau baris besar yang salah dijadikan judul, atur ulang gayanya dari tab Home.
- **Paragraf.** Baris-baris disambung menjadi paragraf utuh, jadi tidak ada jeda baris paksa di setiap akhir baris PDF.
- **Tabel.** Baris yang teksnya sejajar dalam dua kolom atau lebih dijadikan tabel Word. Deteksinya bersifat best-effort, jadi tabel tanpa garis atau tabel rumit mungkin perlu disesuaikan.
- **Pergantian halaman.** Setiap halaman PDF setelah halaman pertama dimulai di halaman baru dalam Word.

Yang tidak ikut terbawa:

- **Gambar, logo, dan tanda tangan.** Ambil dengan [Ekstrak Gambar dari PDF](/id/tools/pdf-extract-images/), lalu sisipkan kembali di Word.
- **Jenis huruf, tebal, miring, dan warna.** Teks memakai gaya bawaan dokumen Word Anda, sehingga mudah diberi gaya baru.
- **Header, footer, dan nomor halaman.** Bagian ini muncul sebagai paragraf biasa di tiap halaman. Hapus saja, atau buat header Word yang sebenarnya.

Tiga pekerjaan perapian yang paling sering:

1. **Tata letak dua kolom berubah jadi tabel.** Teks dua kolom, misalnya pada jurnal atau buletin, terlihat seperti tabel dua kolom dan bisa terbaca sebagai tabel. Klik di dalamnya, pakai **Layout > Convert to Text**, lalu rapikan urutannya. Nama menu bisa sedikit berbeda kalau Word Anda berbahasa Indonesia.
2. **Sisa tanda hubung.** Kata yang terpotong di akhir baris PDF, seperti "keterang-" + "an", tersambung menjadi "keterang- an". Cari tanda hubung yang diikuti spasi, lalu perbaiki yang memang potongan kata.
3. **Baris header dan footer yang nyasar.** Judul laporan yang berulang atau tulisan "Halaman 3 dari 12" di tengah teks berasal dari header atau footer PDF.

## Sebelum mulai: PDF yang dikunci

Jika PDF meminta kata sandi saat dibuka, konversi akan gagal dengan pesan **Maaf, konversi PDF ini gagal.** Hapus dulu kata sandinya dengan [Buka Kunci PDF](/id/tools/pdf-unlock/) (Anda perlu tahu kata sandinya), lalu konversi salinan yang sudah terbuka. Ini biasa terjadi pada e-statement bank atau slip gaji yang dikirim dalam bentuk PDF berkata sandi.

PDF diurai, di-OCR, dan diubah menjadi Word di dalam browser Anda, sehingga isinya tidak diunggah ke server.

## FAQ

### Apakah file Word akan terlihat persis seperti PDF-nya?

Tidak. Anda mendapatkan teks yang bisa diedit dan mengalir, dengan judul, paragraf, dan tabel yang disusun ulang. Jenis huruf asli, gambar, dan posisi persisnya tidak ikut.

### Kenapa hasil konversi kosong atau sebagian besar teksnya hilang?

Kemungkinan besar PDF itu hasil scan yang hanya punya sedikit teks asli di tiap halaman, sehingga tidak terdeteksi sebagai scan. Centang **Paksa OCR (PDF hasil pindaian)**, lalu masukkan file itu lagi.

### Bahasa apa saja yang bisa dibaca OCR?

OCR bekerja paling baik untuk teks beraksara Latin, seperti bahasa Indonesia, Inggris, dan sebagian besar bahasa Eropa. Aksara lain mungkin terbaca kurang akurat.

### Bisakah saya mengonversi satu halaman saja?

Tool ini mengonversi seluruh PDF. Kalau hanya butuh sebagian, ambil halaman yang diperlukan dengan [Pisah PDF](/id/tools/pdf-split/) terlebih dulu, lalu konversi file yang lebih kecil itu. Cara lain, pakai [Gambar ke Teks (OCR)](/id/tools/image-ocr/), yang membaca satu halaman setiap kali dan teksnya bisa langsung disalin.
