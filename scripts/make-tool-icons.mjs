/**
 * Build-time per-tool PWA icons. For each registry tool, render its lucide glyph
 * (white stroke) on a category-colored maskable tile → PNG at 192/512 (maskable
 * safe zone) and 180 (apple-touch). Output: public/manifests/icons/<id>-<size>.png,
 * generated at prebuild (not committed, like public/og/). Mirrors generate-og.mjs.
 * Pass a tool id as argv[2] to render just one (local testing).
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const OUT = 'public/manifests/icons';
mkdirSync(OUT, { recursive: true });

const CAT_COLOR = {
  Dev: '#3b82f6', PDF: '#ef4444', Image: '#22c55e', Files: '#eab308', Documents: '#14b8a6',
  Draw: '#a855f7', Media: '#ec4899', Network: '#06b6d4', Maps: '#10b981', Legacy: '#6366f1',
  Playground: '#f97316', Calculators: '#8b5cf6', Testers: '#0ea5e9',
};

function pascalToKebab(n) {
  return n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])([0-9])/g, '$1-$2').toLowerCase();
}

function readTools() {
  const src = readFileSync('src/registry/tools.ts', 'utf8');
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?load:\s*\(\)\s*=>\s*import\('[^']+'\)[^}]*\}/g;
  const tools = [];
  let m;
  while ((m = re.exec(src))) {
    const e = m[0];
    const g = rx => (e.match(rx) || [])[1] || '';
    tools.push({ id: m[1], category: g(/category:\s*'([^']*)'/), icon: g(/icon:\s*([A-Za-z0-9]+)/) });
  }
  return tools;
}

// lucide-static file: a license comment + <svg …>…glyph…</svg>. Extract the inner glyph.
function glyphInner(iconName) {
  if (!iconName) return null;
  const p = `node_modules/lucide-static/icons/${pascalToKebab(iconName)}.svg`;
  if (!existsSync(p)) return null;
  const svg = readFileSync(p, 'utf8');
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
}

function tile(size, glyph, color, pad) {
  const gs = size - pad * 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${color}"/>
  <g transform="translate(${pad},${pad}) scale(${gs / 24})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>`;
}

const only = process.argv[2];
const tools = readTools().filter(t => !only || t.id === only);
let n = 0;
const missing = [];
for (const t of tools) {
  const glyph = glyphInner(t.icon);
  if (!glyph) missing.push(`${t.id}:${t.icon || '?'}`);
  const g = glyph || '<circle cx="12" cy="12" r="8"/><path d="M12 8v4"/><path d="M12 16h.01"/>';
  const color = CAT_COLOR[t.category] || '#7c3aed';
  for (const [size, pad] of [[192, 44], [512, 120], [180, 30]]) {
    const png = await sharp(Buffer.from(tile(size, g, color, pad))).png().toBuffer();
    writeFileSync(`${OUT}/${t.id}-${size}.png`, png);
  }
  n++;
}
if (missing.length) console.warn(`[make-tool-icons] ${missing.length} tools fell back to a generic glyph: ${missing.join(', ')}`);
console.log(`Generated icons for ${n} tools → ${OUT}/`);
