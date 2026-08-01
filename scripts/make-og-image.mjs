// Generate the default social-share (Open Graph) image at public/og.png.
// 1200x630, opaque, brand-matched (brutalist cream + violet). Run: node scripts/make-og-image.mjs
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#fffdf5"/>
  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#0a0a0a" stroke-width="10"/>
  <rect x="88" y="96" width="156" height="156" fill="#7c3aed" stroke="#0a0a0a" stroke-width="8"/>
  <text x="166" y="200" font-family="Helvetica, Arial, sans-serif" font-size="66" font-weight="700" fill="#ffffff" text-anchor="middle">GWT</text>
  <text x="90" y="380" font-family="Helvetica, Arial, sans-serif" font-size="100" font-weight="800" fill="#0a0a0a">GoodWebTools</text>
  <text x="94" y="452" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="500" fill="#3a3a3a">Privacy-first tools that run entirely in your browser.</text>
  <text x="94" y="524" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="700" fill="#7c3aed">No uploads · No tracking · 100% client-side</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(new URL('../public/og.png', import.meta.url), png);
console.log('Wrote public/og.png', png.length, 'bytes');
