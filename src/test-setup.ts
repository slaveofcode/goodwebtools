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
  // jsdom's native FormData rejects Node Blobs before our wrapper can help, so use a corrected custom shim
  // with proper multi-value storage, filename wrapping, and all required iterators.
  class MockFormData {
    private _storage = new Map<string, FormDataEntryValue[]>();

    private wrapValue(value: string | Blob, filename?: string): FormDataEntryValue {
      // If value is a Node Blob (not already a File) and filename is provided, wrap as File.
      if (value instanceof NodeBlob && !(value instanceof NodeFile) && filename) {
        return new NodeFile([value], filename, { type: (value as Blob).type });
      }
      // If value is a Node Blob without filename, wrap as a File with default name.
      if (value instanceof NodeBlob && !(value instanceof NodeFile)) {
        return new NodeFile([value], 'blob', { type: (value as Blob).type });
      }
      return value as FormDataEntryValue;
    }

    set(name: string, value: string | Blob, filename?: string) {
      this._storage.set(name, [this.wrapValue(value, filename)]);
      return this;
    }

    append(name: string, value: string | Blob, filename?: string) {
      const wrapped = this.wrapValue(value, filename);
      if (this._storage.has(name)) {
        this._storage.get(name)!.push(wrapped);
      } else {
        this._storage.set(name, [wrapped]);
      }
      return this;
    }

    get(name: string): FormDataEntryValue | null {
      const values = this._storage.get(name);
      return values && values.length > 0 ? values[0] : null;
    }

    getAll(name: string): FormDataEntryValue[] {
      return this._storage.get(name) || [];
    }

    has(name: string): boolean {
      return this._storage.has(name);
    }

    delete(name: string): void {
      this._storage.delete(name);
    }

    keys(): IterableIterator<string> {
      return this._storage.keys();
    }

    values(): IterableIterator<FormDataEntryValue> {
      const allValues: FormDataEntryValue[] = [];
      for (const vals of this._storage.values()) {
        allValues.push(...vals);
      }
      return allValues[Symbol.iterator]();
    }

    entries(): IterableIterator<[string, FormDataEntryValue]> {
      const result: [string, FormDataEntryValue][] = [];
      for (const [key, values] of this._storage.entries()) {
        for (const value of values) {
          result.push([key, value]);
        }
      }
      return result[Symbol.iterator]();
    }

    forEach(callback: (value: FormDataEntryValue, key: string, parent: FormData) => void, thisArg?: unknown): void {
      for (const [key, values] of this._storage.entries()) {
        for (const value of values) {
          callback.call(thisArg, value, key, this as unknown as FormData);
        }
      }
    }

    [Symbol.iterator](): IterableIterator<[string, FormDataEntryValue]> {
      return this.entries();
    }
  }

  globalThis.FormData = MockFormData as unknown as typeof FormData;
}
