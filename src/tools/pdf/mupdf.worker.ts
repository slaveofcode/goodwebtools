import * as Comlink from 'comlink';
import * as mupdf from 'mupdf';

// mupdf's high-level object typings don't fully cover the low-level PDFObject
// get/put/asNumber usage below, so a few casts to `any` keep it pragmatic.
/* eslint-disable @typescript-eslint/no-explicit-any */

function open(bytes: Uint8Array): any {
  return mupdf.PDFDocument.openDocument(bytes, 'application/pdf');
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
  /** Re-save a PDF into a clean, standard structure pdf-lib can then parse. */
  normalize(bytes: Uint8Array): Uint8Array {
    const doc = open(bytes);
    try {
      return transfer(save(doc));
    } finally {
      doc.destroy?.();
    }
  },

  countPages(bytes: Uint8Array): number {
    const doc = open(bytes);
    try {
      return doc.countPages();
    } finally {
      doc.destroy?.();
    }
  },

  extractPages(bytes: Uint8Array, pages1: number[]): Uint8Array {
    const src = open(bytes);
    const out: any = new mupdf.PDFDocument();
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

  merge(buffers: Uint8Array[]): Uint8Array {
    const out: any = new mupdf.PDFDocument();
    const sources: any[] = [];
    try {
      for (const bytes of buffers) {
        const src = open(bytes);
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

  rotate(bytes: Uint8Array, turnDegrees: number): Uint8Array {
    const doc = open(bytes);
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

  deletePages(bytes: Uint8Array, pages1: number[]): Uint8Array {
    const doc = open(bytes);
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
