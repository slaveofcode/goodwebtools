#!/usr/bin/env node
/**
 * bundle-tauri-assets.mjs
 *
 * Pre-build script that copies/verifies assets required for the Tauri bundle:
 *   1. Verifies icon assets exist in src-tauri/icons/
 *   2. Checks for bundled FFmpeg sidecar in src-tauri/bin/
 *   3. Reports what's missing so CI fails early with a clear message
 *
 * Run: node scripts/bundle-tauri-assets.mjs
 * Or via: npm run bundle:check
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const TAURI_DIR = join(ROOT, 'src-tauri');
const ICONS_DIR = join(TAURI_DIR, 'icons');
const BIN_DIR = join(TAURI_DIR, 'bin');

const REQUIRED_ICONS = [
  '32x32.png',
  '128x128.png',
  '128x128@2x.png',
  'icon.icns',
  'icon.ico',
  'icon.png',
];

// Target triples that need FFmpeg sidecars for bundled releases
const FFMPEG_TARGETS = [
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
  'x86_64-pc-windows-msvc',
  'x86_64-unknown-linux-gnu',
];

let warnings = 0;
let errors = 0;

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function warn(msg) {
  console.warn(`  ⚠ ${msg}`);
  warnings++;
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  errors++;
}

// ── 1. Icons ──────────────────────────────────────────────────────────────────
console.log('\n[1/3] Checking icon assets…');
if (!existsSync(ICONS_DIR)) {
  fail(`icons/ directory missing at ${ICONS_DIR}`);
  fail('Run: tauri icon path/to/source-icon.png  (requires @tauri-apps/cli)');
} else {
  const existing = readdirSync(ICONS_DIR);
  for (const icon of REQUIRED_ICONS) {
    if (existing.includes(icon)) {
      ok(icon);
    } else {
      warn(`Missing icon: ${icon} — run: tauri icon <source.png>`);
    }
  }
}

// ── 2. FFmpeg sidecars ────────────────────────────────────────────────────────
console.log('\n[2/3] Checking FFmpeg sidecars in src-tauri/bin/…');
const isCi = process.env.CI === 'true';

if (!existsSync(BIN_DIR)) {
  if (isCi) {
    fail(`bin/ directory missing — FFmpeg sidecars required in CI`);
    fail('Run: npm run download:ffmpeg');
  } else {
    warn('bin/ directory missing — FFmpeg will fall back to system ffmpeg');
    warn('To bundle ffmpeg: npm run download:ffmpeg');
  }
} else {
  const binFiles = readdirSync(BIN_DIR);
  for (const triple of FFMPEG_TARGETS) {
    const name = triple.startsWith('x86_64-pc-windows') ? `ffmpeg-${triple}.exe` : `ffmpeg-${triple}`;
    if (binFiles.includes(name)) {
      const size = statSync(join(BIN_DIR, name)).size;
      ok(`${name} (${(size / 1_000_000).toFixed(1)} MB)`);
    } else {
      const msg = `Missing sidecar: ${name}`;
      isCi ? fail(msg) : warn(msg);
    }
  }
}

// ── 3. System checks ──────────────────────────────────────────────────────────
console.log('\n[3/3] System checks…');
try {
  const v = execSync('rustc --version', { encoding: 'utf8' }).trim();
  ok(v);
} catch {
  fail('rustc not found — install Rust: https://rustup.rs');
}

try {
  const v = execSync('cargo --version', { encoding: 'utf8' }).trim();
  ok(v);
} catch {
  fail('cargo not found');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n────────────────────────────────────────');
if (errors > 0) {
  console.error(`\nBundle check FAILED: ${errors} error(s), ${warnings} warning(s)\n`);
  process.exit(1);
} else if (warnings > 0) {
  console.warn(`\nBundle check passed with ${warnings} warning(s) — OK for dev builds\n`);
} else {
  console.log('\nBundle check passed ✓ — ready for release build\n');
}
