import type { Category } from '@/types/tool';
import type { Lang } from '@/i18n/config';

export const categories: Category[] = [
  'Dev',
  'PDF',
  'Image',
  'Files',
  'Documents',
  'Draw',
  'Media',
  'Network',
  'Maps',
  'Calculators',
  'Legacy',
  'Playground'
];

export const categoryColors: Record<Category, string> = {
  Dev: 'bg-blue-500',
  PDF: 'bg-red-500',
  Image: 'bg-green-500',
  Files: 'bg-yellow-500',
  Documents: 'bg-teal-500',
  Draw: 'bg-purple-500',
  Media: 'bg-pink-500',
  Network: 'bg-cyan-500',
  Maps: 'bg-emerald-500',
  Calculators: 'bg-lime-500',
  Legacy: 'bg-indigo-500',
  Playground: 'bg-orange-500'
};

/**
 * Categories whose tools use a limited server-side component. Everything else on
 * GoodWebTools runs fully client-side; Network tools additionally use a minimal
 * signaling server to introduce two devices (only the ~2KB WebRTC handshake — no
 * media or file bytes pass through it), and this can be disabled entirely with the
 * manual (serverless) connection mode.
 */
export const categoryNotes: Partial<Record<Category, string>> = {
  Network: 'These tools connect two devices directly (peer-to-peer). By default a minimal signaling server only introduces the devices — your media and files never pass through it — and you can switch to a fully serverless manual mode or bring your own STUN/TURN servers.',
};

/** URL slug for a category hub page, e.g. 'PDF' → 'pdf'. */
export function categorySlug(category: Category): string {
  return category.toLowerCase();
}

/** Category lead copy in the given language (English fallback). */
export function catDescription(category: Category, lang: Lang): string {
  return lang === 'id' ? categoryDescriptionsId[category] : categoryDescriptions[category];
}

/** SEO lead copy for each category hub page, per language (falls back to English). */
export const categoryDescriptionsId: Record<Category, string> = {
  Dev: 'Utilitas pengembang gratis yang berjalan sepenuhnya di browser Anda — format dan validasi JSON, enkode Base64 dan URL, hash dan bandingkan teks, buat UUID, dan lainnya. Tidak ada yang diunggah.',
  PDF: 'Kelola PDF secara privat di browser Anda — gabung, pisah, perkecil, konversi, perbaiki, lindungi, dan edit. Dokumen Anda tidak pernah meninggalkan perangkat, jadi berkas rahasia pun tetap aman.',
  Image: 'Edit dan konversi gambar di perangkat Anda — ubah ukuran, potong, perkecil, konversi format, hapus latar belakang, tingkatkan resolusi, buramkan wajah, ekstrak teks, dan lainnya. Tanpa unggahan, tanpa tanda air.',
  Files: 'Utilitas berkas sehari-hari yang menjaga data Anda tetap lokal — arsipkan, ekstrak, enkripsi, dan periksa berkas langsung di browser tanpa mengirim apa pun ke server.',
  Documents: 'Lihat dan konversi dokumen di browser Anda — buka berkas Word, OpenDocument, spreadsheet, dan e-book tanpa aplikasi kantor atau unggahan. Dokumen Anda tidak pernah meninggalkan perangkat.',
  Draw: 'Tool menggambar dan membuat diagram sederhana yang berjalan di browser Anda — membuat sketsa, anotasi, dan diagram tanpa akun atau unggahan apa pun.',
  Media: 'Utilitas audio dan video privat — konversi, pangkas, rekam, dan transkripsi media sepenuhnya di perangkat Anda. Rekaman Anda tidak pernah meninggalkan browser.',
  Network: 'Tool peer-to-peer yang menghubungkan dua perangkat secara langsung untuk mentransfer berkas atau berkomunikasi — data Anda mengalir antar perangkat, bukan melalui server.',
  Maps: 'Tool pemetaan sumber terbuka — konversi koordinat, jelajahi dan ekspor peta, serta lihat berkas GeoJSON, GPX, dan KML. Dibangun di atas data peta terbuka, berjalan di browser Anda.',
  Calculators: 'Tool kalkulator sehari-hari yang berjalan di browser Anda — hitung usia dan weton, konversi satuan, serta hitung KPR, zakat, dan THR. Semua perhitungan terjadi di perangkat Anda.',
  Legacy: 'Titipkan pesan dan kata sandi penting untuk keluarga — dienkripsi di perangkat Anda dan hanya bisa dibuka saat waktunya tiba. Tidak ada yang diunggah ke server.',
  Playground: 'Playground interaktif dan eksperimen untuk menjelajah dan belajar — semuanya berjalan di sisi klien di browser Anda.',
};

/** Per-category nouns/actions used to build unique FAQ copy for each hub page. */
const categoryFacts: Record<Category, { en: { noun: string; actions: string }; id: { noun: string; actions: string } }> = {
  Dev: { en: { noun: 'inputs', actions: 'formatting JSON, encoding Base64, hashing text and generating UUIDs' }, id: { noun: 'input', actions: 'memformat JSON, meng-encode Base64, hashing teks, dan membuat UUID' } },
  PDF: { en: { noun: 'PDFs', actions: 'merging, splitting, compressing, signing and editing' }, id: { noun: 'PDF', actions: 'menggabung, memisah, memperkecil, menandatangani, dan mengedit' } },
  Image: { en: { noun: 'images', actions: 'resizing, cropping, converting, removing backgrounds and extracting text' }, id: { noun: 'gambar', actions: 'mengubah ukuran, memotong, mengonversi, menghapus latar, dan mengekstrak teks' } },
  Files: { en: { noun: 'files', actions: 'archiving, extracting, encrypting and inspecting' }, id: { noun: 'berkas', actions: 'mengarsip, mengekstrak, mengenkripsi, dan memeriksa' } },
  Documents: { en: { noun: 'documents', actions: 'opening Word, OpenDocument, spreadsheet and e-book files' }, id: { noun: 'dokumen', actions: 'membuka berkas Word, OpenDocument, spreadsheet, dan e-book' } },
  Draw: { en: { noun: 'drawings', actions: 'sketching, annotating and diagramming' }, id: { noun: 'gambar', actions: 'membuat sketsa, anotasi, dan diagram' } },
  Media: { en: { noun: 'recordings', actions: 'converting, trimming, recording and transcribing' }, id: { noun: 'rekaman', actions: 'mengonversi, memangkas, merekam, dan mentranskripsi' } },
  Network: { en: { noun: 'files', actions: 'transferring files and communicating device to device' }, id: { noun: 'berkas', actions: 'mentransfer berkas dan berkomunikasi antar perangkat' } },
  Maps: { en: { noun: 'map data', actions: 'converting coordinates and viewing GeoJSON, GPX and KML' }, id: { noun: 'data peta', actions: 'mengonversi koordinat dan melihat GeoJSON, GPX, dan KML' } },
  Calculators: { en: { noun: 'numbers', actions: 'calculating age and weton, converting units and working out finances' }, id: { noun: 'angka', actions: 'menghitung usia dan weton, mengonversi satuan, dan menghitung keuangan' } },
  Legacy: { en: { noun: 'messages', actions: 'encrypting messages and passwords for your family' }, id: { noun: 'pesan', actions: 'mengenkripsi pesan dan kata sandi untuk keluarga' } },
  Playground: { en: { noun: 'inputs', actions: 'experimenting and learning interactively' }, id: { noun: 'input', actions: 'bereksperimen dan belajar secara interaktif' } },
};

/** Unique, keyword-aware FAQ for each category hub page (for FAQPage rich results). */
export function categoryFaqs(category: Category, lang: Lang): { q: string; a: string }[] {
  const f = categoryFacts[category][lang === 'id' ? 'id' : 'en'];
  if (lang === 'id') {
    return [
      { q: `Apakah ${f.noun} saya diunggah ke server?`, a: `Tidak. Setiap tool kategori ${category} berjalan di browser Anda — ${f.actions} semuanya terjadi di perangkat Anda, jadi ${f.noun} Anda tidak pernah diunggah.` },
      { q: 'Apakah perlu memasang aplikasi atau membuat akun?', a: 'Tidak. Buka halaman dan langsung pakai tool mana pun — tanpa instalasi, tanpa pendaftaran, tanpa batas, dan tanpa tanda air.' },
      { q: `Apakah tool ${category} ini bekerja offline?`, a: 'Ya. GoodWebTools adalah PWA, jadi setelah dimuat tool tetap berjalan tanpa koneksi internet.' },
      { q: `Apakah tool ${category} ini gratis?`, a: `Ya, setiap tool di kategori ${category} gratis sepenuhnya — tanpa batas dan tanpa tanda air.` },
    ];
  }
  return [
    { q: `Are my ${f.noun} uploaded to a server?`, a: `No. Every ${category} tool on GoodWebTools runs in your browser — ${f.actions} all happen on your device, so your ${f.noun} never leave it.` },
    { q: 'Do I need to install anything or create an account?', a: 'No install and no sign-up. Open the page and use any tool instantly — no limits and no watermarks.' },
    { q: `Do these ${category} tools work offline?`, a: 'Yes. GoodWebTools is a PWA, so once loaded the tools keep working with no internet connection.' },
    { q: `Are these ${category} tools free?`, a: `Yes — every tool in the ${category} category is completely free, with no limits or watermarks.` },
  ];
}

/** SEO lead copy for each category hub page (unique, keyword-aware). */
export const categoryDescriptions: Record<Category, string> = {
  Dev: 'Free developer utilities that run entirely in your browser — format and validate JSON, encode Base64 and URLs, hash and diff text, generate UUIDs, and more. Nothing is uploaded.',
  PDF: 'Work with PDFs privately in your browser — merge, split, compress, convert, repair, protect and edit. Your documents never leave your device, so even confidential files stay safe.',
  Image: 'Edit and convert images on your device — resize, crop, compress, convert formats, remove backgrounds, upscale, blur faces, extract text and more. No uploads, no watermarks.',
  Files: 'Everyday file utilities that keep your data local — archive, extract, encrypt and inspect files right in the browser with nothing sent to a server.',
  Documents: 'View and convert documents in your browser — open Word, OpenDocument, spreadsheet and e-book files with no office app and no upload. Your documents never leave your device.',
  Draw: 'Simple drawing and diagramming tools that run in your browser — sketch, annotate and create diagrams without an account or any upload.',
  Media: 'Private audio and video utilities — convert, trim, record and transcribe media entirely on your device using on-device processing. Your recordings never leave your browser.',
  Network: 'Peer-to-peer tools that connect two devices directly to transfer files or communicate — your data flows device to device, not through a server.',
  Maps: 'Open-source mapping tools — convert coordinates, explore and export maps, and view GeoJSON, GPX and KML files. Built on open map data, running in your browser.',
  Calculators: 'Everyday calculators that run in your browser — work out age and Javanese weton, convert units, and calculate mortgage, zakat and THR. Every calculation happens on your device.',
  Legacy: 'Entrust messages and important passwords to your family — encrypted on your device and openable only when the time comes. Nothing is uploaded to any server.',
  Playground: 'Interactive playgrounds and experiments to explore and learn — all running client-side in your browser.',
};
