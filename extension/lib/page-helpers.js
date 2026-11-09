// Pure helpers for the page tools: color formats, image lists, full-page capture plan.

/** "#7c3aed" → { hex: "#7C3AED", rgb: "rgb(124, 58, 237)", hsl: "hsl(262, 83%, 58%)" }. */
export function colorFormats(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === rf ? (gf - bf) / d + (gf < bf ? 6 : 0) : max === gf ? (bf - rf) / d + 2 : (rf - gf) / d + 4;
    h *= 60;
  }
  return {
    hex: `#${m[1].toUpperCase()}`,
    rgb: `rgb(${r}, ${g}, ${b})`,
    hsl: `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`,
  };
}

/** The largest candidate in a srcset ("a.jpg 480w, b.jpg 1080w" → "b.jpg"), or null. */
export function largestFromSrcset(srcset) {
  let best = null;
  let bestScore = -1;
  for (const part of (srcset || '').split(/,\s+(?=\S)/)) {
    const [url, size = '1x'] = part.trim().split(/\s+/);
    if (!url) continue;
    const score = parseFloat(size) * (size.endsWith('w') ? 1 : 1000);
    if (score > bestScore) { bestScore = score; best = url; }
  }
  return best;
}

/** Drop duplicates, tiny images (icons, tracking pixels) and non-http(s)/data URLs; biggest first. */
export function cleanImageList(images, minSide = 48) {
  const seen = new Set();
  return images
    .filter((im) => /^(https?:|data:image\/)/.test(im.src) && !seen.has(im.src) && seen.add(im.src))
    .filter((im) => !(im.width && im.height) || Math.min(im.width, im.height) >= minSide)
    .sort((a, b) => (b.width * b.height || 0) - (a.width * a.height || 0));
}

/** File name for a downloaded image: last path segment, sanitised, with the right extension. */
export function imageFileName(src, index, ext) {
  let base = `image-${index + 1}`;
  if (!src.startsWith('data:')) {
    try {
      const seg = decodeURIComponent(new URL(src).pathname.split('/').pop() || '');
      if (seg) base = seg.replace(/\.[a-z0-9]{2,5}$/i, '');
    } catch { /* keep the fallback */ }
  }
  base = base.replace(/[^\w.-]+/g, '-').slice(0, 80) || `image-${index + 1}`;
  return `${String(index + 1).padStart(3, '0')}-${base}.${ext}`;
}

/** Make names unique inside a zip ("a.png", "a-2.png", …). */
export function uniqueNames(names) {
  const used = new Map();
  return names.map((n) => {
    const k = used.get(n) || 0;
    used.set(n, k + 1);
    return k ? n.replace(/(\.[^.]+)?$/, `-${k + 1}$1`) : n;
  });
}

/**
 * Scroll positions for a full-page capture: viewport-sized steps down the page,
 * the last one clamped to the bottom, stopping at `maxHeight` CSS pixels.
 */
export function capturePlan(pageHeight, viewportHeight, maxHeight = 30000) {
  const height = Math.min(pageHeight, maxHeight);
  const ys = [];
  for (let y = 0; y < height; y += viewportHeight) ys.push(Math.min(y, Math.max(0, height - viewportHeight)));
  return { ys: [...new Set(ys)], height, truncated: pageHeight > maxHeight };
}

// ── Media (audio, video, HLS streams) ────────────────────────────────────────

const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'weba', 'mka'];
const VIDEO_EXT = ['mp4', 'm4v', 'webm', 'mov', 'mkv', 'ogv', 'avi', '3gp'];
const HLS_EXT = ['m3u8'];

/** File extension of a URL's path ("https://x/a.MP3?x=1" → "mp3"), or "". */
export function urlExtension(src) {
  try {
    const m = /\.([a-z0-9]{2,5})$/i.exec(new URL(src).pathname);
    return m ? m[1].toLowerCase() : '';
  } catch { return ''; }
}

/** 'audio' | 'video' | 'hls' | null, from a MIME type hint or the URL's extension. */
export function mediaKind(src, type = '') {
  const t = (type || '').toLowerCase();
  if (/mpegurl/.test(t)) return 'hls';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('video/')) return 'video';
  const ext = urlExtension(src);
  if (HLS_EXT.includes(ext)) return 'hls';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (VIDEO_EXT.includes(ext)) return 'video';
  return null;
}

/**
 * Clean the media found on a page: http(s) only, classified, one entry per URL
 * (the first label wins; an element's own kind beats a guess from the URL).
 * Anything the page marked as protected is left out — and on a DRM page
 * (`drm`), so is everything seen only in the network list.
 */
export function cleanMediaList(items, { drm = false } = {}) {
  const locked = new Set(items.filter((it) => it.restricted).map((it) => (it.src || '').replace(/#.*$/, '')));
  const byUrl = new Map();
  for (const it of items) {
    if (it.restricted || (drm && it.via === 'network')) continue;
    if (locked.has((it.src || '').replace(/#.*$/, ''))) continue;
    if (!/^https?:/.test(it.src || '')) continue;
    const key = it.src.replace(/#.*$/, '');
    const kind = mediaKind(key, it.type) || it.kind || null;
    if (!kind) continue;
    const prev = byUrl.get(key);
    if (!prev) byUrl.set(key, { src: key, kind, label: (it.label || '').trim().slice(0, 120) });
    else if (!prev.label && it.label) prev.label = it.label.trim().slice(0, 120);
  }
  const order = { video: 0, hls: 1, audio: 2 };
  return [...byUrl.values()].sort((a, b) => order[a.kind] - order[b.kind]);
}

/** Pages where saving media isn't offered (their terms and the Chrome Web Store policy forbid it). */
export function isMediaBlockedSite(pageUrl) {
  try {
    const h = new URL(pageUrl).hostname.replace(/^www\.|^m\.|^music\./, '');
    return ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'soundcloud.com'].some((d) => h === d || h.endsWith(`.${d}`));
  } catch { return false; }
}

/**
 * Parse an HLS playlist. A master playlist gives `variants` (best first); a media
 * playlist gives `segments`, an fMP4 `init` segment, and whether it is encrypted
 * (any key other than METHOD=NONE) or live (no #EXT-X-ENDLIST).
 */
export function parseM3u8(text, baseUrl) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines[0] !== '#EXTM3U') return null;
  const abs = (u) => new URL(u, baseUrl).href;
  const attr = (line, name) => {
    const m = new RegExp(`[:,]${name}=("([^"]*)"|[^,]*)`).exec(line);
    return m ? (m[2] ?? m[1]) : null;
  };
  if (lines.some((l) => l.startsWith('#EXT-X-STREAM-INF'))) {
    const variants = [];
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#EXT-X-STREAM-INF')) continue;
      const uri = lines.slice(i + 1).find((l) => !l.startsWith('#'));
      if (!uri) continue;
      variants.push({ url: abs(uri), bandwidth: Number(attr(lines[i], 'BANDWIDTH')) || 0, resolution: attr(lines[i], 'RESOLUTION') || '' });
    }
    variants.sort((a, b) => b.bandwidth - a.bandwidth);
    return { type: 'master', variants };
  }
  const segments = [];
  let init = null;
  let encrypted = false;
  for (const l of lines) {
    if (l.startsWith('#EXT-X-KEY') && (attr(l, 'METHOD') || 'NONE').toUpperCase() !== 'NONE') encrypted = true;
    else if (l.startsWith('#EXT-X-MAP')) { const u = attr(l, 'URI'); if (u) init = abs(u); }
    else if (!l.startsWith('#')) segments.push(abs(l));
  }
  return { type: 'media', segments, init, encrypted, live: !lines.includes('#EXT-X-ENDLIST') };
}

/** File extension to save a media file under, from its type or URL. */
export function mediaExtension(src, mime, kind) {
  const fromMime = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/opus': 'opus', 'audio/flac': 'flac', 'audio/webm': 'weba', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv', 'video/ogg': 'ogv', 'video/mp2t': 'ts' }[(mime || '').split(';')[0].trim().toLowerCase()];
  const ext = urlExtension(src);
  if ([...AUDIO_EXT, ...VIDEO_EXT].includes(ext)) return ext;
  return fromMime || (kind === 'audio' ? 'mp3' : 'mp4');
}

// ── Password, links ──────────────────────────────────────────────────────────

/** A strong random password: letters, digits and symbols, at least one of each. */
export function strongPassword(length = 20, rand = crypto) {
  const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%^&*-_=+?'];
  const all = sets.join('');
  const pickFrom = (s) => { const b = new Uint32Array(1); rand.getRandomValues(b); return s[b[0] % s.length]; };
  const chars = sets.map(pickFrom);
  while (chars.length < length) chars.push(pickFrom(all));
  for (let i = chars.length - 1; i > 0; i--) { // shuffle so the required ones aren't always first
    const b = new Uint32Array(1); rand.getRandomValues(b);
    const j = b[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Links as CSV (URL, text), quoted where needed. */
export function linksToCsv(links) {
  const q = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return ['url,text', ...links.map((l) => `${q(l.href)},${q(l.text || '')}`)].join('\n');
}
