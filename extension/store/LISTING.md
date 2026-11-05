# Chrome Web Store listing — GoodWebTools Companion

Everything to paste into the Chrome Web Store developer dashboard
(<https://chrome.google.com/webstore/devconsole>). Package:
`npm run build && node scripts/pack-extension.mjs` →
`dist-extension/goodwebtools-companion-<version>.zip`.

Images in this folder: `screenshots/01…05-*.png` (1280×800) and
`promo-440x280.png` (small promo tile). Store icon: `../icons/icon128.png`.
Regenerate them with `node scripts/store-assets.mjs`.

---

## Store listing (English — default)

**Name:** GoodWebTools Companion  *(from the manifest)*

**Summary** (≤ 132 characters, from the manifest):
Right-click images or text to open them in 200+ free tools, search every tool, and capture the screen — all in your browser.

**Category:** Productivity → Tools
**Language:** English (Indonesian added as a second listing language)

**Description:**

GoodWebTools is a collection of 200+ free tools that run entirely in your browser —
nothing is uploaded. The Companion brings them to every page you visit.

RIGHT-CLICK → THE RIGHT TOOL
• On any image: compress, convert (WebP, PNG, JPG…), resize, remove the background,
  extract text (OCR), read a QR code or upscale it.
• On selected text: format or view JSON as a tree, Base64 encode/decode, hash, count
  words, read it aloud, or make a QR code.
• On a link or page: make a QR code.
The tool opens with your image or text already loaded.

SEARCH EVERY TOOL
The toolbar popup searches all GoodWebTools tools in English and Bahasa Indonesia.
Star favorites, reopen recent tools, make a QR code of the current page.

TOOLS BESIDE ANY PAGE
Pin tools to Chrome's side panel — Music Player, JSON Viewer, Notepad, Unit
Converter and more. Music keeps playing while you switch tabs.

RECORD A TAB OR YOUR SCREEN
Record the current tab with its sound (no picker) or a screen/window, optionally with
your microphone. Alt+Shift+R starts and stops. Then download the video, or convert it
to MP4 or a GIF.

GRAB WHAT YOU NEED FROM A PAGE
• Save the page's images — pick, convert to WebP/PNG/JPG, download as one zip.
• Full-page screenshot — scrolls and stitches the whole page.
• Color picker — click anywhere on screen, copy HEX/RGB/HSL.
• JSON pages (optional) — open API responses and .json files in the JSON Viewer.

PRIVATE BY DESIGN
No accounts, no analytics, no ads in the extension. Your files and text go from the
extension to the GoodWebTools tab in your own browser and are processed there.
Access to other websites is optional and only asked for when a feature needs it.
GoodWebTools is open source: https://github.com/slaveofcode/goodwebtools

Also: Ctrl/⌘+Shift+Y captures the screen even while another app is focused.

---

## Store listing (Bahasa Indonesia)

**Ringkasan:**
Klik kanan gambar atau teks untuk membukanya di 200+ tool gratis, cari semua tool, dan tangkap layar — semua di browser Anda.

**Deskripsi:**

GoodWebTools adalah kumpulan 200+ tool gratis yang berjalan sepenuhnya di browser Anda
— tidak ada yang diunggah. Companion menghadirkannya di setiap halaman yang Anda buka.

KLIK KANAN → TOOL YANG TEPAT
• Pada gambar apa pun: kompres, konversi (WebP, PNG, JPG…), ubah ukuran, hapus latar
  belakang, ambil teks (OCR), baca kode QR, atau perbesar.
• Pada teks yang dipilih: format atau lihat JSON sebagai pohon, encode/decode Base64,
  hash, hitung kata, bacakan, atau buat kode QR.
• Pada tautan atau halaman: buat kode QR.
Tool terbuka dengan gambar atau teks Anda sudah dimuat.

CARI SEMUA TOOL
Popup di toolbar mencari semua tool GoodWebTools dalam Bahasa Indonesia dan Inggris.
Tandai favorit, buka lagi tool terakhir, buat kode QR halaman yang sedang dibuka.

TOOL DI SAMPING HALAMAN APA PUN
Sematkan tool di panel samping Chrome — Pemutar Musik, Penampil JSON, Notepad,
Pengonversi Satuan, dan lainnya. Musik tetap diputar saat Anda berpindah tab.

REKAM TAB ATAU LAYAR
Rekam tab yang sedang dibuka beserta suaranya (tanpa memilih sumber) atau layar/jendela,
bisa dengan mikrofon. Alt+Shift+R untuk mulai dan berhenti. Lalu unduh videonya, atau
ubah ke MP4 atau GIF.

AMBIL YANG ANDA PERLUKAN DARI HALAMAN
• Simpan gambar di halaman — pilih, ubah ke WebP/PNG/JPG, unduh sebagai satu zip.
• Tangkapan layar satu halaman penuh — menggulir dan menyatukan seluruh halaman.
• Pengambil warna — klik di mana saja di layar, salin HEX/RGB/HSL.
• Halaman JSON (opsional) — buka respons API dan berkas .json di Penampil JSON.

PRIVAT SEJAK AWAL
Tanpa akun, tanpa analitik, tanpa iklan di ekstensi. Berkas dan teks Anda berpindah dari
ekstensi ke tab GoodWebTools di browser Anda sendiri dan diproses di sana. Akses ke
situs lain bersifat opsional dan hanya diminta saat sebuah fitur membutuhkannya.
GoodWebTools bersumber terbuka: https://github.com/slaveofcode/goodwebtools

Juga: Ctrl/⌘+Shift+Y menangkap layar meski aplikasi lain sedang aktif.

---

## Privacy practices tab

**Single purpose:**
Send content from the page you are on (images, selected text, links, recordings,
screenshots) to GoodWebTools' in-browser tools, and open those tools from the toolbar
and side panel.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `contextMenus` | Adds the GoodWebTools right-click menu on images, selected text, links and pages. |
| `activeTab` | Reads the selected text or image the user right-clicked, and runs "this page" actions (color picker, save images, full-page screenshot, record this tab) on the tab where the user invoked the extension. |
| `scripting` | Injects the color-picker panel, collects image URLs for "Save images", scrolls for the full-page screenshot, and registers the optional JSON-page detector — only after a user action. |
| `storage` | Stores settings (language, favorites, recent and pinned tools, microphone choice) and passes a payload to the tool page for up to 5 minutes. |
| `notifications` | Tells the user when an action couldn't run (e.g. an image that can't be read, a capture that failed). |
| `desktopCapture` | Screen/window capture for the screenshot hotkey and "Record screen", chosen by the user in Chrome's picker. |
| `tabCapture` | "Record this tab" — records the tab the user invoked the extension on, with its sound. |
| `offscreen` | Captures frames and runs the MediaRecorder (and plays the captured tab's sound back) — these need a document, which a service worker lacks. |
| `sidePanel` | Shows GoodWebTools tools in Chrome's side panel. |
| Host: `https://goodwebtools.com/*` | Hands data to GoodWebTools tool pages and refreshes the tool list (`/tools-index.json`). |
| Optional host: `<all_urls>` | Requested only when needed: reading right-clicked images on other sites, downloading a page's images, and showing the "Open in JSON Viewer" bar on JSON pages. Can be revoked anytime. |

**Remote code:** No. All code is in the package; the extension opens goodwebtools.com
pages (a website, not code executed by the extension).

**Data usage** (what to tick): the extension does **not** collect or transmit any of
the listed data categories to the developer. Website content the user chooses to send
(an image, text, URL, recording or screenshot) is only passed to the GoodWebTools tab
in the user's own browser and processed locally.
Certify: not sold to third parties; not used for unrelated purposes; not used for
creditworthiness/lending.

**Privacy policy URL:** https://goodwebtools.com/privacy#extension

---

## Other fields

- **Homepage URL:** https://goodwebtools.com
- **Support URL:** https://github.com/slaveofcode/goodwebtools/issues
- **Visibility:** Public · **Regions:** all
- **Mature content:** No

## Submitting (once the developer account exists)

1. Create the developer account at <https://chrome.google.com/webstore/devconsole>
   (one-time $5 fee) with the Google account that should own the listing.
2. *New item* → upload the zip from `dist-extension/`.
3. *Store listing*: paste the English summary and description above; add Indonesian
   via *Add language*. Upload the icon, the 5 screenshots and the promo tile.
4. *Privacy practices*: paste the single purpose and each permission justification;
   answer data usage as above; privacy policy URL.
5. *Submit for review*. Reviews with `<all_urls>` (optional) and capture permissions
   can take several days; the justifications above are what reviewers read.
6. After approval, put the store link in the README and on the site.
