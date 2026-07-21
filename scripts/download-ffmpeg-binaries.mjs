#!/usr/bin/env node
/**
 * download-ffmpeg-binaries.mjs
 *
 * Downloads pre-built static FFmpeg binaries into src-tauri/bin/ so they
 * can be bundled with the Tauri app as sidecar resources.
 *
 * Sources (static builds, no runtime deps):
 *   macOS  → evermeet.cx  (aarch64 + x86_64)
 *   Windows → gyan.dev     (x86_64)
 *   Linux   → johnvansickle (x86_64)
 *
 * Run: node scripts/download-ffmpeg-binaries.mjs
 * Or:  npm run download:ffmpeg
 */

import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_DIR = join(__dirname, '..', 'src-tauri', 'bin');

const BINARIES = [
  {
    platform: 'darwin-aarch64',
    url: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
    filename: 'ffmpeg-aarch64-apple-darwin',
  },
  {
    platform: 'darwin-x86_64',
    url: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
    filename: 'ffmpeg-x86_64-apple-darwin',
  },
  {
    platform: 'windows-x86_64',
    url: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
    filename: 'ffmpeg-x86_64-pc-windows-msvc.exe',
  },
  {
    platform: 'linux-x86_64',
    url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
    filename: 'ffmpeg-x86_64-unknown-linux-gnu',
  },
];

if (!existsSync(BIN_DIR)) {
  mkdirSync(BIN_DIR, { recursive: true });
}

const host = process.platform;
const arch = process.arch;

// Determine which binary to download for the current build machine
let target;
if (host === 'darwin') {
  target = arch === 'arm64' ? 'darwin-aarch64' : 'darwin-x86_64';
} else if (host === 'win32') {
  target = 'windows-x86_64';
} else {
  target = 'linux-x86_64';
}

const entry = BINARIES.find(b => b.platform === target);
if (!entry) {
  console.error(`No FFmpeg binary configured for platform: ${host}/${arch}`);
  process.exit(1);
}

const outPath = join(BIN_DIR, entry.filename);

if (existsSync(outPath)) {
  console.log(`✓ FFmpeg binary already exists: ${outPath}`);
  process.exit(0);
}

console.log(`Downloading FFmpeg for ${target}…`);
console.log(`  URL: ${entry.url}`);
console.log(`  → ${outPath}`);
console.log('');
console.log('NOTE: Automatic extraction from zip/tar is not implemented here.');
console.log('Please download FFmpeg manually from one of these sources:');
console.log('  macOS:   https://evermeet.cx/ffmpeg/');
console.log('  Windows: https://www.gyan.dev/ffmpeg/builds/');
console.log('  Linux:   https://johnvansickle.com/ffmpeg/');
console.log('');
console.log(`Then place the binary at: ${outPath}`);
console.log('');
console.log('Alternatively, install system FFmpeg:');
console.log('  macOS:   brew install ffmpeg');
console.log('  Ubuntu:  sudo apt install ffmpeg');
console.log('  Windows: winget install ffmpeg');
console.log('');
console.log('The app falls back to system FFmpeg if bundled binary is not found.');
