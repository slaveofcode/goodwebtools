// Package the GoodWebTools Companion extension for the Chrome Web Store.
//
//   npm run build && node scripts/pack-extension.mjs
//
// Refreshes the bundled tool list from the build (dist/tools-index.json), then
// zips extension/ (minus tests and dotfiles) to
// dist-extension/goodwebtools-companion-<version>.zip.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const root = new URL('..', import.meta.url).pathname;
const ext = join(root, 'extension');
const built = join(root, 'dist', 'tools-index.json');

if (existsSync(built)) {
  writeFileSync(join(ext, 'data', 'tools-index.json'), readFileSync(built));
  console.log('Updated extension/data/tools-index.json from the build.');
} else {
  console.warn('dist/tools-index.json not found — run `npm run build` first to refresh the tool list. Using the existing snapshot.');
}

const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name.startsWith('.') || name.endsWith('.test.js') || name === 'README.md' || name === 'store') continue; // store/ = listing assets, not packaged
    if (statSync(p).isDirectory()) walk(p);
    else files[relative(ext, p)] = readFileSync(p);
  }
};
walk(ext);

const { version } = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
const outDir = join(root, 'dist-extension');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `goodwebtools-companion-${version}.zip`);
writeFileSync(out, zipSync(files, { level: 9 }));
console.log(`Packed ${Object.keys(files).length} files → ${relative(root, out)}`);
