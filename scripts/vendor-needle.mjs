// Vendors the Needle engine's Emscripten JS wrapper (used by the Voice to Text
// "Fast" Whistle model) as an ES module, so no remote JS is executed at runtime.
// The matching needle.wasm and whistle.cact are fetched at runtime through the
// /hf proxy, pinned to the same commits and SHA-256 verified (see whistle.engine.ts).
//
//   node scripts/vendor-needle.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const COMMIT = '2ae11323dc000f5e70c49f7403efa6af12ba9e67';
const SHA256 = '964681b2a5ec3c4db2f06e45a5b60c8981a7d4ab4cac16ef6bf5b1988657a5f1';
const URL_ = `https://huggingface.co/Cactus-Compute/needle3/resolve/${COMMIT}/wasm/needle.js`;

const res = await fetch(URL_);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const src = Buffer.from(await res.arrayBuffer());
const hash = createHash('sha256').update(src).digest('hex');
if (hash !== SHA256) throw new Error(`needle.js hash mismatch: ${hash}`);

const header = `/* eslint-disable */
// @ts-nocheck
// Needle engine JS wrapper (Emscripten), vendored unmodified except for the
// trailing ES export. Source: huggingface.co/Cactus-Compute/needle3 @ ${COMMIT}
// (wasm/needle.js, sha256 ${SHA256}). Licensed under Apache-2.0 — see ./LICENSE.
// Regenerate with: node scripts/vendor-needle.mjs
`;
writeFileSync('src/vendor/needle/needle.mjs', header + src.toString('utf8') + '\nexport default createNeedle;\n');

const lic = await fetch(`https://huggingface.co/Cactus-Compute/needle3/resolve/${COMMIT}/LICENSE`);
if (!lic.ok) throw new Error(`LICENSE download failed: ${lic.status}`);
writeFileSync('src/vendor/needle/LICENSE', Buffer.from(await lic.arrayBuffer()));
console.log('Vendored needle.mjs + LICENSE');
