// Copies WASM/worker assets into public/ so they're served same-origin
// (no CDN). Run automatically by predev/prebuild; outputs are gitignored.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('public/libarchive', { recursive: true });
copyFileSync('node_modules/mupdf/dist/mupdf-wasm.wasm', 'public/mupdf-wasm.wasm');
copyFileSync('node_modules/libarchive.js/dist/worker-bundle.js', 'public/libarchive/worker-bundle.js');
copyFileSync('node_modules/libarchive.js/dist/libarchive.wasm', 'public/libarchive/libarchive.wasm');
console.log('Copied WASM/worker assets into public/.');
