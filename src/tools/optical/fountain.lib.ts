/**
 * LT (Luby Transform) fountain codec for the optical transfer tool.
 *
 * Each frame is the XOR of a pseudo-random subset of the file's blocks, with the
 * subset derived deterministically from the frame's sequence number — so both the
 * sender and receiver compute the same subset from `seq` alone. The receiver peels
 * (belief propagation) until every block is solved, regardless of frame order/loss.
 */

/** Deterministic PRNG (mulberry32) — same output on both devices for a given seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Robust-soliton CDF, memoized per block count. Index d-1 holds P(degree ≤ d).
const cdfCache = new Map<number, number[]>();
function robustSolitonCdf(k: number): number[] {
  const cached = cdfCache.get(k);
  if (cached) return cached;

  const c = 0.03;
  const delta = 0.5;
  const R = c * Math.log(k / delta) * Math.sqrt(k);
  const pivot = Math.max(1, Math.round(k / R));

  const rho = new Array<number>(k + 1).fill(0);
  rho[1] = 1 / k;
  for (let d = 2; d <= k; d++) rho[d] = 1 / (d * (d - 1));

  const tau = new Array<number>(k + 1).fill(0);
  for (let d = 1; d < pivot; d++) tau[d] = R / (d * k);
  if (pivot <= k) tau[pivot] = (R * Math.log(R / delta)) / k;

  let z = 0;
  for (let d = 1; d <= k; d++) z += rho[d] + tau[d];

  const cdf = new Array<number>(k).fill(0);
  let acc = 0;
  for (let d = 1; d <= k; d++) {
    acc += (rho[d] + tau[d]) / z;
    cdf[d - 1] = acc;
  }
  cdf[k - 1] = 1; // guard against FP drift
  cdfCache.set(k, cdf);
  return cdf;
}

/** The block indices a frame combines, derived deterministically from `seq`. */
export function frameIndices(seq: number, k: number): number[] {
  if (k <= 1) return [0];
  const rng = mulberry32(seq >>> 0);
  const cdf = robustSolitonCdf(k);
  const r = rng();
  let degree = 1;
  while (degree < k && cdf[degree - 1] < r) degree++;

  const picked = new Set<number>();
  while (picked.size < degree) picked.add(Math.floor(rng() * k));
  return [...picked].sort((a, b) => a - b);
}

function xorInto(target: Uint8Array, src: Uint8Array): void {
  for (let i = 0; i < target.length; i++) target[i] ^= src[i];
}

/** Split bytes into fixed-size blocks (last one zero-padded). */
export function bytesToBlocks(bytes: Uint8Array, blockSize: number): Uint8Array[] {
  const k = Math.max(1, Math.ceil(bytes.length / blockSize));
  const blocks: Uint8Array[] = [];
  for (let i = 0; i < k; i++) {
    const block = new Uint8Array(blockSize);
    block.set(bytes.subarray(i * blockSize, i * blockSize + blockSize));
    blocks.push(block);
  }
  return blocks;
}

/** Concatenate solved blocks and trim to the original size. */
export function blocksToBytes(blocks: Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(blocks.length * (blocks[0]?.length ?? 0));
  blocks.forEach((b, i) => out.set(b, i * b.length));
  return out.subarray(0, size);
}

export class LtEncoder {
  readonly k: number;
  private blocks: Uint8Array[];
  private blockSize: number;

  constructor(blocks: Uint8Array[]) {
    this.blocks = blocks;
    this.k = blocks.length;
    this.blockSize = blocks[0]?.length ?? 0;
  }

  /** The XOR payload for frame `seq`. */
  frame(seq: number): Uint8Array {
    const out = new Uint8Array(this.blockSize);
    for (const i of frameIndices(seq, this.k)) xorInto(out, this.blocks[i]);
    return out;
  }
}

export class LtDecoder {
  readonly k: number;
  private blockSize: number;
  private solved: (Uint8Array | null)[];
  solvedCount = 0;
  private seenSeq = new Set<number>();
  // Outstanding equations: unsolved index set + accumulated xor value.
  private equations: { indices: Set<number>; value: Uint8Array }[] = [];

  constructor(k: number, blockSize: number) {
    this.k = k;
    this.blockSize = blockSize;
    this.solved = new Array(k).fill(null);
  }

  get done(): boolean {
    return this.solvedCount >= this.k;
  }

  progress(): number {
    return this.k === 0 ? 1 : this.solvedCount / this.k;
  }

  /** Feed one frame. Returns true once the whole file is solved. */
  addFrame(seq: number, payload: Uint8Array): boolean {
    if (this.done || this.seenSeq.has(seq)) return this.done;
    this.seenSeq.add(seq);

    const indices = new Set<number>();
    const value = payload.slice();
    for (const i of frameIndices(seq, this.k)) {
      if (this.solved[i]) xorInto(value, this.solved[i]!);
      else indices.add(i);
    }
    this.reduceAndSolve(indices, value);
    return this.done;
  }

  private reduceAndSolve(indices: Set<number>, value: Uint8Array): void {
    const queue: { indices: Set<number>; value: Uint8Array }[] = [{ indices, value }];
    while (queue.length) {
      const eq = queue.shift()!;
      // Drop indices already solved since this equation was queued.
      for (const i of [...eq.indices]) {
        if (this.solved[i]) { xorInto(eq.value, this.solved[i]!); eq.indices.delete(i); }
      }
      if (eq.indices.size === 0) continue; // redundant
      if (eq.indices.size > 1) { this.equations.push(eq); continue; }

      // Degree 1 → solve this block, then cascade into other equations.
      const idx = eq.indices.values().next().value as number;
      if (this.solved[idx]) continue;
      this.solved[idx] = eq.value;
      this.solvedCount++;

      const still: { indices: Set<number>; value: Uint8Array }[] = [];
      for (const other of this.equations) {
        if (other.indices.has(idx)) {
          xorInto(other.value, eq.value);
          other.indices.delete(idx);
          if (other.indices.size <= 1) queue.push(other);
          else still.push(other);
        } else {
          still.push(other);
        }
      }
      this.equations = still;
    }
  }

  /** The k solved blocks in order (call only when `done`). */
  recover(): Uint8Array[] {
    return this.solved.map(b => b ?? new Uint8Array(this.blockSize));
  }
}
