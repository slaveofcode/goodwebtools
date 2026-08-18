/**
 * MIME type ⇄ file extension reference + lookup. Pure and framework-free.
 * Covers the common web/dev types; not an exhaustive IANA registry.
 */

export interface MimeEntry {
  ext: string;
  mime: string;
  name: string;
}

export const MIME_TYPES: MimeEntry[] = [
  // Text & code
  { ext: 'txt', mime: 'text/plain', name: 'Plain text' },
  { ext: 'html', mime: 'text/html', name: 'HTML document' },
  { ext: 'htm', mime: 'text/html', name: 'HTML document' },
  { ext: 'css', mime: 'text/css', name: 'Cascading Style Sheet' },
  { ext: 'csv', mime: 'text/csv', name: 'Comma-separated values' },
  { ext: 'md', mime: 'text/markdown', name: 'Markdown' },
  { ext: 'ics', mime: 'text/calendar', name: 'iCalendar' },
  { ext: 'js', mime: 'text/javascript', name: 'JavaScript' },
  { ext: 'mjs', mime: 'text/javascript', name: 'JavaScript module' },
  { ext: 'json', mime: 'application/json', name: 'JSON' },
  { ext: 'jsonld', mime: 'application/ld+json', name: 'JSON-LD' },
  { ext: 'xml', mime: 'application/xml', name: 'XML' },
  { ext: 'yaml', mime: 'application/yaml', name: 'YAML' },
  { ext: 'yml', mime: 'application/yaml', name: 'YAML' },
  { ext: 'wasm', mime: 'application/wasm', name: 'WebAssembly' },
  { ext: 'sh', mime: 'application/x-sh', name: 'Shell script' },

  // Images
  { ext: 'png', mime: 'image/png', name: 'PNG image' },
  { ext: 'jpg', mime: 'image/jpeg', name: 'JPEG image' },
  { ext: 'jpeg', mime: 'image/jpeg', name: 'JPEG image' },
  { ext: 'gif', mime: 'image/gif', name: 'GIF image' },
  { ext: 'webp', mime: 'image/webp', name: 'WebP image' },
  { ext: 'avif', mime: 'image/avif', name: 'AVIF image' },
  { ext: 'svg', mime: 'image/svg+xml', name: 'SVG vector image' },
  { ext: 'bmp', mime: 'image/bmp', name: 'Bitmap image' },
  { ext: 'ico', mime: 'image/vnd.microsoft.icon', name: 'Icon' },
  { ext: 'tif', mime: 'image/tiff', name: 'TIFF image' },
  { ext: 'tiff', mime: 'image/tiff', name: 'TIFF image' },
  { ext: 'heic', mime: 'image/heic', name: 'HEIC image' },

  // Audio & video
  { ext: 'mp3', mime: 'audio/mpeg', name: 'MP3 audio' },
  { ext: 'wav', mime: 'audio/wav', name: 'WAV audio' },
  { ext: 'ogg', mime: 'audio/ogg', name: 'Ogg audio' },
  { ext: 'oga', mime: 'audio/ogg', name: 'Ogg audio' },
  { ext: 'weba', mime: 'audio/webm', name: 'WebM audio' },
  { ext: 'aac', mime: 'audio/aac', name: 'AAC audio' },
  { ext: 'flac', mime: 'audio/flac', name: 'FLAC audio' },
  { ext: 'mp4', mime: 'video/mp4', name: 'MP4 video' },
  { ext: 'webm', mime: 'video/webm', name: 'WebM video' },
  { ext: 'ogv', mime: 'video/ogg', name: 'Ogg video' },
  { ext: 'mov', mime: 'video/quicktime', name: 'QuickTime video' },
  { ext: 'avi', mime: 'video/x-msvideo', name: 'AVI video' },
  { ext: 'mkv', mime: 'video/x-matroska', name: 'Matroska video' },

  // Fonts
  { ext: 'woff', mime: 'font/woff', name: 'WOFF font' },
  { ext: 'woff2', mime: 'font/woff2', name: 'WOFF2 font' },
  { ext: 'ttf', mime: 'font/ttf', name: 'TrueType font' },
  { ext: 'otf', mime: 'font/otf', name: 'OpenType font' },
  { ext: 'eot', mime: 'application/vnd.ms-fontobject', name: 'Embedded OpenType font' },

  // Documents
  { ext: 'pdf', mime: 'application/pdf', name: 'PDF document' },
  { ext: 'doc', mime: 'application/msword', name: 'Microsoft Word (legacy)' },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'Microsoft Word' },
  { ext: 'xls', mime: 'application/vnd.ms-excel', name: 'Microsoft Excel (legacy)' },
  { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'Microsoft Excel' },
  { ext: 'ppt', mime: 'application/vnd.ms-powerpoint', name: 'Microsoft PowerPoint (legacy)' },
  { ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', name: 'Microsoft PowerPoint' },
  { ext: 'odt', mime: 'application/vnd.oasis.opendocument.text', name: 'OpenDocument Text' },
  { ext: 'ods', mime: 'application/vnd.oasis.opendocument.spreadsheet', name: 'OpenDocument Spreadsheet' },
  { ext: 'epub', mime: 'application/epub+zip', name: 'EPUB e-book' },
  { ext: 'rtf', mime: 'application/rtf', name: 'Rich Text Format' },

  // Archives & binary
  { ext: 'zip', mime: 'application/zip', name: 'ZIP archive' },
  { ext: 'gz', mime: 'application/gzip', name: 'Gzip archive' },
  { ext: 'tar', mime: 'application/x-tar', name: 'TAR archive' },
  { ext: '7z', mime: 'application/x-7z-compressed', name: '7-Zip archive' },
  { ext: 'rar', mime: 'application/vnd.rar', name: 'RAR archive' },
  { ext: 'bin', mime: 'application/octet-stream', name: 'Binary data' },
];

const clean = (s: string) => s.trim().toLowerCase().replace(/^\./, '');

/** All entries for a file extension (e.g. "jpg" or ".jpg"). */
export function byExtension(ext: string): MimeEntry[] {
  const e = clean(ext);
  return MIME_TYPES.filter((m) => m.ext === e);
}

/** All entries for a MIME type (exact match, case-insensitive). */
export function byMime(mime: string): MimeEntry[] {
  const m = mime.trim().toLowerCase();
  return MIME_TYPES.filter((e) => e.mime === m);
}

/**
 * Free-text search across extension, MIME type and name. A leading dot on an
 * extension is ignored. Empty query returns everything.
 */
export function searchMime(query: string): MimeEntry[] {
  const q = clean(query);
  if (!q) return MIME_TYPES;
  return MIME_TYPES.filter(
    (m) => m.ext.includes(q) || m.mime.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
  );
}
