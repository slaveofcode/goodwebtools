// Upload the staged ML model tree (public/models/**) to the R2 bucket(s) used by
// production and/or staging, preserving each file's relative path as its R2 key.
//
//   node scripts/sync-r2.mjs production   # top-level bucket (main → prod)
//   node scripts/sync-r2.mjs staging      # env.staging bucket (develop → staging)
//   node scripts/sync-r2.mjs all          # every unique bucket, once
//   ... --dry-run                         # list what would upload, no writes
//
// Prereqs: `npm run stage:models` (fills public/models/**) and Cloudflare auth
// (CLOUDFLARE_API_TOKEN env var, or `wrangler login`). Bucket names are read from
// wrangler.jsonc so this stays correct if prod/staging buckets ever diverge.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const MODELS_DIR = path.join(ROOT, 'public', 'models');
const WRANGLER = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const target = args.find((a) => !a.startsWith('-')) ?? 'production';

/** Read bucket names from wrangler.jsonc for the requested target(s). */
function resolveBuckets(which) {
  const raw = readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const cfg = JSON.parse(raw);
  const prod = cfg.r2_buckets?.[0]?.bucket_name;
  const staging = cfg.env?.staging?.r2_buckets?.[0]?.bucket_name;
  const map = { production: prod, staging };
  if (which === 'all') {
    // Dedupe — prod and staging may share one bucket (no double upload).
    return [...new Set([prod, staging].filter(Boolean))].map((b) => ({ env: b === prod ? 'production' : 'staging', bucket: b }));
  }
  const bucket = map[which];
  if (!bucket) {
    console.error(`Unknown target "${which}". Use: production | staging | all`);
    process.exit(1);
  }
  return [{ env: which, bucket }];
}

/** All files under public/models/**, as { key, file } with POSIX keys.
 *  Skips dotfiles/dot-directories (e.g. .wrangler cache, .DS_Store) — those
 *  aren't model assets and must not become R2 keys. */
function collectFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full, base));
    else if (entry.isFile()) out.push({ key: path.relative(base, full).split(path.sep).join('/'), file: full });
  }
  return out;
}

function humanSize(bytes) {
  const u = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

if (!existsSync(MODELS_DIR)) {
  console.error(`No staged models at ${MODELS_DIR}\nRun \`npm run stage:models\` first.`);
  process.exit(1);
}

const files = collectFiles(MODELS_DIR);
if (files.length === 0) {
  console.error(`No files under ${MODELS_DIR} — run \`npm run stage:models\`.`);
  process.exit(1);
}
const totalBytes = files.reduce((n, f) => n + statSync(f.file).size, 0);
const buckets = resolveBuckets(target);

console.log(
  `Syncing ${files.length} files (${humanSize(totalBytes)}) → ${buckets.map((b) => `${b.bucket} [${b.env}]`).join(', ')}` +
    (dryRun ? '  (dry run)' : ''),
);

const failures = [];
for (const { bucket, env } of buckets) {
  console.log(`\n▶ ${bucket} (${env})`);
  let done = 0;
  for (const { key, file } of files) {
    done++;
    const label = `  [${done}/${files.length}] ${key}`;
    if (dryRun) { console.log(`${label}  (skip: dry run)`); continue; }
    const res = spawnSync(WRANGLER, ['r2', 'object', 'put', `${bucket}/${key}`, '--file', file, '--remote'], {
      encoding: 'utf8',
    });
    if (res.status === 0) {
      console.log(label);
    } else {
      console.error(`${label}  ✗ FAILED`);
      if (res.stderr) console.error(res.stderr.trim());
      failures.push(`${bucket}/${key}`);
    }
  }
}

if (failures.length) {
  console.error(`\n${failures.length} upload(s) failed. Re-run to retry (uploads are idempotent):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(dryRun ? '\nDry run complete — nothing uploaded.' : '\n✓ Sync complete.');
