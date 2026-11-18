// Builds an output file from the positioned writes a muxer makes (MP4 and WebM
// go back to patch box sizes and headers), keeping it as a list of pieces
// instead of one contiguous buffer. The final Blob is assembled from the pieces,
// so a large file is held in memory once, not two or three times — which is what
// lets a phone finish a long video instead of the tab being killed.

interface Piece { pos: number; bytes: Uint8Array }

export class SparseFileWriter {
  private pieces: Piece[] = [];
  private end = 0;

  /** Total size of the file so far. */
  get size(): number { return this.end; }

  /** Write `data` at byte `position`, overwriting any bytes already there. */
  write(data: Uint8Array, position: number): void {
    const copy = data.slice(); // the muxer may reuse its buffer
    let at = position;
    let src = 0;
    // Patch bytes that overlap earlier pieces.
    if (at < this.end) {
      for (const p of this.pieces) {
        const pEnd = p.pos + p.bytes.length;
        if (pEnd <= at || p.pos >= position + copy.length) continue;
        const from = Math.max(at, p.pos);
        const to = Math.min(position + copy.length, pEnd);
        p.bytes.set(copy.subarray(from - position, to - position), from - p.pos);
      }
      src = Math.min(copy.length, this.end - position);
      at = position + src;
    }
    if (src >= copy.length) return;
    if (at > this.end) this.pieces.push({ pos: this.end, bytes: new Uint8Array(at - this.end) }); // gap → zeros
    this.pieces.push({ pos: at, bytes: src === 0 ? copy : copy.subarray(src) });
    this.end = at + copy.length - src;
  }

  /** The file as a Blob made of the pieces. */
  toBlob(type: string): Blob {
    return new Blob(this.pieces.map(p => p.bytes as BlobPart), { type });
  }
}
