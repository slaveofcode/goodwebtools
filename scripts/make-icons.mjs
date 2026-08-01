// Generate the PWA / app icons with the GWT brand (was a black square).
// Maskable-safe: full-bleed violet background, "GWT" kept within the center safe
// zone. Run: node scripts/make-icons.mjs
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const VIOLET = '#7c3aed';

// fontFactor: text size as a fraction of the icon side. Smaller = more safe-zone
// padding (for maskable). Apple icons don't need a safe zone, so they run larger.
function iconSvg(size, fontFactor) {
  const fs = Math.round(size * fontFactor);
  const y = Math.round(size * 0.5 + fs * 0.35); // optical vertical centering
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${VIOLET}"/>
  <text x="${size / 2}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${fs}" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="${Math.round(size * 0.006)}">GWT</text>
</svg>`;
}

const targets = [
  { file: 'icon-512.png', size: 512, font: 0.28 }, // maskable safe zone
  { file: 'icon-192.png', size: 192, font: 0.28 }, // maskable safe zone
  { file: 'apple-touch-icon.png', size: 180, font: 0.34 }, // iOS just rounds corners
];

for (const t of targets) {
  const png = await sharp(Buffer.from(iconSvg(t.size, t.font))).png().toBuffer();
  writeFileSync(new URL(`../public/${t.file}`, import.meta.url), png);
  console.log(`Wrote public/${t.file} (${t.size}x${t.size}, ${png.length} bytes)`);
}
