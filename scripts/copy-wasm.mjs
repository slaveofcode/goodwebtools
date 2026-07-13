// Copies WASM/worker/font assets into public/ so they're served same-origin
// (no CDN). Run automatically by predev/prebuild; outputs are gitignored.
import { copyFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';

mkdirSync('public/libarchive', { recursive: true });
copyFileSync('node_modules/mupdf/dist/mupdf-wasm.wasm', 'public/mupdf-wasm.wasm');
copyFileSync('node_modules/libarchive.js/dist/worker-bundle.js', 'public/libarchive/worker-bundle.js');
copyFileSync('node_modules/libarchive.js/dist/libarchive.wasm', 'public/libarchive/libarchive.wasm');

// Excalidraw fonts (self-hosted via window.EXCALIDRAW_ASSET_PATH = '/excalidraw/').
const excaliFonts = 'node_modules/@excalidraw/excalidraw/dist/prod/fonts';
if (existsSync(excaliFonts)) {
  mkdirSync('public/excalidraw/fonts', { recursive: true });
  cpSync(excaliFonts, 'public/excalidraw/fonts', { recursive: true });
}

// SQLite WASM (served same-origin at /sqlite/; loaded by the sqlite.worker).
const sqliteSrc = 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm';
if (existsSync(sqliteSrc)) {
  mkdirSync('public/sqlite', { recursive: true });
  for (const f of ['sqlite3.wasm', 'sqlite3.mjs']) {
    if (existsSync(`${sqliteSrc}/${f}`)) copyFileSync(`${sqliteSrc}/${f}`, `public/sqlite/${f}`);
  }
}

console.log('Copied WASM/worker/font assets into public/.');
