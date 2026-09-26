import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

// jsdom ships a partial Blob/File that lack arrayBuffer/text/stream. Back Blob
// and File with Node's implementations (which have them), and bridge jsdom's
// FileReader — which only accepts jsdom-native blobs — by copying a Node blob's
// bytes into a jsdom Blob before reading.
if (typeof globalThis.Blob !== 'undefined' && !globalThis.Blob.prototype.arrayBuffer) {
  const JsdomBlob = globalThis.Blob;
  const OriginalFileReader = globalThis.FileReader;
  const OriginalFormData = globalThis.FormData;

  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  globalThis.File = NodeFile as unknown as typeof File;

  const toJsdomBlob = (blob: Blob): Promise<Blob> =>
    blob.arrayBuffer().then(buf => new JsdomBlob([buf], { type: blob.type }));

  globalThis.FileReader = class PatchedFileReader extends OriginalFileReader {
    readAsText(blob: Blob, encoding?: string) {
      if (blob instanceof NodeBlob) {
        toJsdomBlob(blob).then(
          b => super.readAsText(b, encoding),
          () => this.dispatchEvent(new Event('error')),
        );
        return;
      }
      return super.readAsText(blob, encoding);
    }

    readAsArrayBuffer(blob: Blob) {
      if (blob instanceof NodeBlob) {
        toJsdomBlob(blob).then(
          b => super.readAsArrayBuffer(b),
          () => this.dispatchEvent(new Event('error')),
        );
        return;
      }
      return super.readAsArrayBuffer(blob);
    }
  };

  // Patch FormData to accept Node Blobs (which are our globalThis.Blob after replacement).
  // Store them in a side map; jsdom's native FormData.set() would reject them.
  class MockFormData {
    private _storage = new Map<string, unknown>();

    set(name: string, value: string | Blob, filename?: string) {
      this._storage.set(name, value);
      return this;
    }

    append(name: string, value: string | Blob, filename?: string) {
      this._storage.set(name, value);
      return this;
    }

    get(name: string): FormDataEntryValue | null {
      return (this._storage.get(name) as FormDataEntryValue) || null;
    }

    delete(name: string) {
      this._storage.delete(name);
    }

    has(name: string) {
      return this._storage.has(name);
    }

    getAll(name: string) {
      const val = this._storage.get(name);
      return val ? [val as FormDataEntryValue] : [];
    }

    entries() {
      return this._storage.entries();
    }

    forEach(cb: (value: FormDataEntryValue, key: string) => void, thisArg?: unknown) {
      this._storage.forEach((v, k) => cb(v as FormDataEntryValue, k));
    }

    [Symbol.iterator]() {
      return this._storage.entries();
    }
  }

  globalThis.FormData = MockFormData as unknown as typeof FormData;
}
