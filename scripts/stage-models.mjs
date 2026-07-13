// Stages ML model assets into public/models/ for LOCAL DEV (served at /models/…,
// the same paths the R2 Worker uses in production). Everything here is gitignored
// and is NOT part of the production build — in production these live in the R2
// bucket under the same prefixes. See DEPLOYMENT.md.
import { cpSync, mkdirSync, existsSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';

function stageImgly() {
  const SRC = 'node_modules/@imgly/background-removal-data/dist';
  const DEST = 'public/models/imgly';
  if (!existsSync(SRC)) {
    console.warn('Skipping imgly: run `npm i -D @imgly/background-removal-data`');
    return;
  }
  mkdirSync(DEST, { recursive: true });
  cpSync(SRC, DEST, { recursive: true });
  console.log(`Staged Background-Remover assets → ${DEST}`);
}

async function stageMediapipe() {
  const WASM_SRC = 'node_modules/@mediapipe/tasks-vision/wasm';
  const DEST = 'public/models/mediapipe';
  if (!existsSync(WASM_SRC)) {
    console.warn('Skipping mediapipe: run `npm i @mediapipe/tasks-vision`');
    return;
  }
  mkdirSync(`${DEST}/wasm`, { recursive: true });
  cpSync(WASM_SRC, `${DEST}/wasm`, { recursive: true });

  const model = `${DEST}/blaze_face_short_range.tflite`;
  if (!existsSync(model)) {
    const url =
      'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download face model: ${res.status}`);
    writeFileSync(model, Buffer.from(await res.arrayBuffer()));
    console.log('Downloaded face-detection model.');
  }
  console.log(`Staged Face-Blur assets → ${DEST}`);
}

function stageUpscaler() {
  const SRC = 'node_modules/@upscalerjs/esrgan-slim/models';
  const DEST = 'public/models/esrgan-slim';
  if (!existsSync(SRC)) {
    console.warn('Skipping upscaler: run `npm i @upscalerjs/esrgan-slim`');
    return;
  }
  mkdirSync(DEST, { recursive: true });
  cpSync(SRC, DEST, { recursive: true });
  console.log(`Staged Upscaler models → ${DEST}`);
}

function stageOrt() {
  const SRC = 'node_modules/onnxruntime-web/dist';
  const DEST = 'public/models/ort';
  if (!existsSync(SRC)) {
    console.warn('Skipping onnxruntime-web: run `npm i onnxruntime-web`');
    return;
  }
  mkdirSync(DEST, { recursive: true });
  for (const f of readdirSync(SRC)) {
    if (f.endsWith('.wasm') || f.endsWith('.mjs')) copyFileSync(`${SRC}/${f}`, `${DEST}/${f}`);
  }
  console.log(`Staged onnxruntime-web WASM → ${DEST}`);
}

async function stageLama() {
  const DEST = 'public/models/lama';
  const model = `${DEST}/lama_fp32.onnx`;
  mkdirSync(DEST, { recursive: true });
  if (!existsSync(model)) {
    console.log('Downloading LaMa inpainting model (~200 MB, one-time)…');
    const res = await fetch('https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx');
    if (!res.ok) throw new Error(`Failed to download LaMa model: ${res.status}`);
    writeFileSync(model, Buffer.from(await res.arrayBuffer()));
  }
  console.log(`Staged Object-Remover model → ${DEST}`);
}

stageImgly();
stageUpscaler();
stageOrt();
await stageMediapipe();
await stageLama();
console.log('Done. For production, upload public/models/* to the R2 bucket. See DEPLOYMENT.md.');
