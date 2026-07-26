#!/usr/bin/env node
/**
 * download-ffmpeg-binaries.mjs
 *
 * Downloads a static FFmpeg binary for the CURRENT host into src-tauri/bin/ so
 * `tauri build` can bundle it as a sidecar (externalBin "bin/ffmpeg"). Needed for
 * local release builds; CI does the same per target in release.yml.
 *
 * Source: eugeneware/ffmpeg-static (raw single-file binaries, no extraction).
 *
 * Run: npm run download:ffmpeg
 */

import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_DIR = join(__dirname, '..', 'src-tauri', 'bin');
const FFMPEG_STATIC_TAG = 'b6.0';

// host platform/arch → { rust target triple, ffmpeg-static asset name }
const TARGETS = {
  'darwin-arm64': { triple: 'aarch64-apple-darwin', asset: 'ffmpeg-darwin-arm64' },
  'darwin-x64': { triple: 'x86_64-apple-darwin', asset: 'ffmpeg-darwin-x64' },
  'win32-x64': { triple: 'x86_64-pc-windows-msvc', asset: 'ffmpeg-win32-x64' },
  'linux-x64': { triple: 'x86_64-unknown-linux-gnu', asset: 'ffmpeg-linux-x64' },
};

const key = `${process.platform}-${process.arch}`;
const target = TARGETS[key];
if (!target) {
  console.error(`No FFmpeg binary configured for ${key}.`);
  console.error(`Supported: ${Object.keys(TARGETS).join(', ')}`);
  process.exit(1);
}

const ext = process.platform === 'win32' ? '.exe' : '';
const outPath = join(BIN_DIR, `ffmpeg-${target.triple}${ext}`);

if (existsSync(outPath)) {
  console.log(`✓ Already present: ${outPath}`);
  process.exit(0);
}

const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_STATIC_TAG}/${target.asset}`;

mkdirSync(BIN_DIR, { recursive: true });
console.log(`Downloading FFmpeg (${key}) …`);
console.log(`  ${url}`);

const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) {
  console.error(`Download failed: HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync(outPath, buf);
if (process.platform !== 'win32') chmodSync(outPath, 0o755);

console.log(`✓ Saved ${(buf.length / 1_000_000).toFixed(1)} MB → ${outPath}`);
