// Post-build cleanup: remove redundant assets that would otherwise exceed
// Cloudflare Workers' 25 MiB per-asset limit and break deployment.
//
// onnxruntime-web's wasm gets emitted into dist/_astro by Vite, but the app
// loads ORT from /models/ort/ at runtime (ort.env.wasm.wasmPaths — served from
// R2 / same-origin), so the bundled copy is dead weight. Drop it.
import { readdirSync, rmSync, existsSync } from 'node:fs';

const ASTRO_DIR = 'dist/_astro';
let removed = 0;

if (existsSync(ASTRO_DIR)) {
  for (const file of readdirSync(ASTRO_DIR)) {
    if (/^ort-.*\.wasm$/.test(file)) {
      rmSync(`${ASTRO_DIR}/${file}`);
      removed++;
      console.log(`Pruned redundant bundled ORT wasm: ${file}`);
    }
  }
}

console.log(`prune-dist: removed ${removed} redundant asset(s).`);
