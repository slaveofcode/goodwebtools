// Fails the build if a regular chunk statically imports one of the big chunks
// that must only ever load on demand (media engine, on-device AI, formatters).
// Rollup folds shared helpers into manual chunks unless they have their own
// (see manualChunks in astro.config.mjs) — this catches that coming back.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.argv[2] || 'dist', '_astro');
const LAZY = /^(mediabunny(-aac|-mp3)?|web-llm|prettier-[a-z0-9-]+)\.[A-Za-z0-9_-]+\.js$/;
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.js'));
const bad = [];
for (const f of files) {
  if (LAZY.test(f)) continue; // lazy chunks may import each other
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  for (const m of src.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) {
    if (LAZY.test(m[1])) bad.push(`${f} → ${m[1]}`);
  }
}
if (bad.length) {
  console.error(`check-chunks: ${bad.length} chunk(s) load an on-demand bundle up front:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-chunks: ok (${files.length} chunks)`);
