import { createEngine, type OcrEngine, type RawLine, type OcrBackend } from './ocr.engine';

export type OcrReason = 'engine-unsupported' | 'model-download' | 'inference' | 'no-text' | 'input';

export class OcrError extends Error {
  reason: OcrReason;
  constructor(reason: OcrReason, message: string) {
    super(message);
    this.name = 'OcrError';
    this.reason = reason;
  }
}

export type OcrLine = RawLine;
export interface OcrResult {
  text: string;
  lines: OcrLine[];
  backend: OcrBackend;
}

const NO_TEXT_MSG = 'No text detected — try turning on Clean up image, or use a clearer/tighter crop.';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Init failures: a network/fetch problem means the model download failed;
// anything else means the engine can't run in this browser.
function toInitError(err: unknown): OcrError {
  const msg = messageOf(err).toLowerCase();
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('download')) {
    return new OcrError(
      'model-download',
      'Couldn’t download the OCR model (network error or blocked). First use needs a connection — check it and retry.',
    );
  }
  return new OcrError(
    'engine-unsupported',
    'On-device OCR couldn’t start: this browser can’t run the OCR engine (missing WebAssembly SIMD support).',
  );
}

let enginePromise: Promise<OcrEngine> | null = null;

/** Lazily create the engine once. On failure, clear the cache so a retry re-inits. */
export function getEngine(): Promise<OcrEngine> {
  if (!enginePromise) {
    enginePromise = createEngine().catch((err) => {
      enginePromise = null;
      throw toInitError(err);
    });
  }
  return enginePromise;
}

/** Drop the cached engine (used by tests and any future "unload model" action). */
export function resetEngine(): void {
  enginePromise = null;
}

// Reading order: top-to-bottom, then left-to-right within a row (rows judged by
// vertical overlap so items on the same visual line stay together).
function sortReadingOrder(lines: RawLine[]): RawLine[] {
  return [...lines].sort((a, b) => {
    const rowTol = Math.min(a.box.height, b.box.height) * 0.5;
    if (Math.abs(a.box.y - b.box.y) > rowTol) return a.box.y - b.box.y;
    return a.box.x - b.box.x;
  });
}

// Assemble text: group reading-ordered items into rows (same-row = space-joined),
// then join rows with newlines. Handles both line-level and segment-level boxes.
function assembleText(sorted: RawLine[]): string {
  const rows: RawLine[][] = [];
  for (const item of sorted) {
    const row = rows[rows.length - 1];
    const tol = row ? Math.min(row[0].box.height, item.box.height) * 0.5 : 0;
    if (row && Math.abs(item.box.y - row[0].box.y) <= tol) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }
  return rows.map((row) => row.map((w) => w.text).join(' ')).join('\n');
}

/** Recognize text in a prepared canvas. Throws OcrError with a specific reason. */
export async function recognize(canvas: HTMLCanvasElement): Promise<OcrResult> {
  const engine = await getEngine();
  let raw: RawLine[];
  try {
    raw = await engine.recognize(canvas);
  } catch (err) {
    throw new OcrError('inference', `OCR failed: ${messageOf(err)}`);
  }
  const lines = sortReadingOrder(raw);
  if (lines.length === 0) throw new OcrError('no-text', NO_TEXT_MSG);
  return { text: assembleText(lines), lines, backend: engine.backend };
}
