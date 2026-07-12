import './mupdf-setup'; // must run before mupdf loads its wasm
import * as Comlink from 'comlink';

// mupdf's high-level object typings don't fully cover the low-level PDFObject
// get/put/asNumber usage below, so a few casts to `any` keep it pragmatic.
/* eslint-disable @typescript-eslint/no-explicit-any */

type Mupdf = typeof import('mupdf');

// Load mupdf lazily so this worker can Comlink.expose() immediately. mupdf's
// module uses a top-level `await` to instantiate its wasm; importing it at the
// top would suspend the whole worker (and every RPC call) until that resolves —
// or forever if it fails. A timeout turns a silent hang into a real error.
let mupdfPromise: Promise<Mupdf> | null = null;
function loadMupdf(): Promise<Mupdf> {
  if (!mupdfPromise) {
    mupdfPromise = Promise.race([
      import('mupdf'),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('PDF engine failed to load (mupdf wasm init timed out).')),
          20000
        )
      ),
    ]).catch(err => {
      mupdfPromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return mupdfPromise;
}

function open(mupdf: Mupdf, bytes: Uint8Array): any {
  return (mupdf as any).PDFDocument.openDocument(bytes, 'application/pdf');
}

function save(doc: any): Uint8Array {
  const buffer = doc.saveToBuffer('');
  // asUint8Array() is a view into wasm memory — copy it out before freeing.
  const copy = buffer.asUint8Array().slice();
  buffer.destroy?.();
  return copy;
}

const transfer = (bytes: Uint8Array) => Comlink.transfer(bytes, [bytes.buffer]);

const api = {
  async normalize(bytes: Uint8Array): Promise<Uint8Array> {
    const mupdf = await loadMupdf();
    const doc = open(mupdf, bytes);
    try {
      return transfer(save(doc));
    } finally {
      doc.destroy?.();
    }
  },

  async countPages(bytes: Uint8Array): Promise<number> {
    const mupdf = await loadMupdf();
    const doc = open(mupdf, bytes);
    try {
      return doc.countPages();
    } finally {
      doc.destroy?.();
    }
  },

  async extractPages(bytes: Uint8Array, pages1: number[]): Promise<Uint8Array> {
    const mupdf = await loadMupdf();
    const src = open(mupdf, bytes);
    const out: any = new (mupdf as any).PDFDocument();
    try {
      const total = src.countPages();
      for (const page of pages1) {
        if (page >= 1 && page <= total) out.graftPage(-1, src, page - 1);
      }
      if (out.countPages() === 0) throw new Error(`No valid pages selected — this PDF has ${total} page(s).`);
      return transfer(save(out));
    } finally {
      src.destroy?.();
      out.destroy?.();
    }
  },

  async merge(buffers: Uint8Array[]): Promise<Uint8Array> {
    const mupdf = await loadMupdf();
    const out: any = new (mupdf as any).PDFDocument();
    const sources: any[] = [];
    try {
      for (const bytes of buffers) {
        const src = open(mupdf, bytes);
        sources.push(src);
        const count = src.countPages();
        for (let i = 0; i < count; i++) out.graftPage(-1, src, i);
      }
      return transfer(save(out));
    } finally {
      sources.forEach(src => src.destroy?.());
      out.destroy?.();
    }
  },

  async rotate(bytes: Uint8Array, turnDegrees: number): Promise<Uint8Array> {
    const mupdf = await loadMupdf();
    const doc = open(mupdf, bytes);
    try {
      const count = doc.countPages();
      for (let i = 0; i < count; i++) {
        const page = doc.findPage(i);
        const current = page.get('Rotate');
        const value = current && current.isNumber ? current.asNumber() : 0;
        page.put('Rotate', (((value + turnDegrees) % 360) + 360) % 360);
      }
      return transfer(save(doc));
    } finally {
      doc.destroy?.();
    }
  },

  async deletePages(bytes: Uint8Array, pages1: number[]): Promise<Uint8Array> {
    const mupdf = await loadMupdf();
    const doc = open(mupdf, bytes);
    try {
      const total = doc.countPages();
      const indices = [...new Set(pages1.map(p => p - 1))]
        .filter(i => i >= 0 && i < total)
        .sort((a, b) => b - a); // descending so earlier deletions don't shift indices
      if (indices.length >= total) throw new Error('Cannot remove every page.');
      for (const i of indices) doc.deletePage(i);
      return transfer(save(doc));
    } finally {
      doc.destroy?.();
    }
  },
};

export type MupdfApi = typeof api;
Comlink.expose(api);
