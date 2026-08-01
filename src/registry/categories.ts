import type { Category } from '@/types/tool';
import type { Lang } from '@/i18n/config';

export const categories: Category[] = [
  'Dev',
  'PDF',
  'Image',
  'Files',
  'Draw',
  'Media',
  'Network',
  'Maps',
  'Playground'
];

export const categoryColors: Record<Category, string> = {
  Dev: 'bg-blue-500',
  PDF: 'bg-red-500',
  Image: 'bg-green-500',
  Files: 'bg-yellow-500',
  Draw: 'bg-purple-500',
  Media: 'bg-pink-500',
  Network: 'bg-cyan-500',
  Maps: 'bg-emerald-500',
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
  Draw: 'Tool menggambar dan membuat diagram sederhana yang berjalan di browser Anda — membuat sketsa, anotasi, dan diagram tanpa akun atau unggahan apa pun.',
  Media: 'Utilitas audio dan video privat — konversi, pangkas, rekam, dan transkripsi media sepenuhnya di perangkat Anda. Rekaman Anda tidak pernah meninggalkan browser.',
  Network: 'Tool peer-to-peer yang menghubungkan dua perangkat secara langsung untuk mentransfer berkas atau berkomunikasi — data Anda mengalir antar perangkat, bukan melalui server.',
  Maps: 'Tool pemetaan sumber terbuka — konversi koordinat, jelajahi dan ekspor peta, serta lihat berkas GeoJSON, GPX, dan KML. Dibangun di atas data peta terbuka, berjalan di browser Anda.',
  Playground: 'Playground interaktif dan eksperimen untuk menjelajah dan belajar — semuanya berjalan di sisi klien di browser Anda.',
};

/** SEO lead copy for each category hub page (unique, keyword-aware). */
export const categoryDescriptions: Record<Category, string> = {
  Dev: 'Free developer utilities that run entirely in your browser — format and validate JSON, encode Base64 and URLs, hash and diff text, generate UUIDs, and more. Nothing is uploaded.',
  PDF: 'Work with PDFs privately in your browser — merge, split, compress, convert, repair, protect and edit. Your documents never leave your device, so even confidential files stay safe.',
  Image: 'Edit and convert images on your device — resize, crop, compress, convert formats, remove backgrounds, upscale, blur faces, extract text and more. No uploads, no watermarks.',
  Files: 'Everyday file utilities that keep your data local — archive, extract, encrypt and inspect files right in the browser with nothing sent to a server.',
  Draw: 'Simple drawing and diagramming tools that run in your browser — sketch, annotate and create diagrams without an account or any upload.',
  Media: 'Private audio and video utilities — convert, trim, record and transcribe media entirely on your device using on-device processing. Your recordings never leave your browser.',
  Network: 'Peer-to-peer tools that connect two devices directly to transfer files or communicate — your data flows device to device, not through a server.',
  Maps: 'Open-source mapping tools — convert coordinates, explore and export maps, and view GeoJSON, GPX and KML files. Built on open map data, running in your browser.',
  Playground: 'Interactive playgrounds and experiments to explore and learn — all running client-side in your browser.',
};
