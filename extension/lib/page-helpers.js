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
