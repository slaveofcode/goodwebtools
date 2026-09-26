// Polyfill jsdom's Blob with Node's native Blob, which has arrayBuffer/text/stream.
// jsdom ships a partial Blob that lacks these standard methods.
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

if (typeof globalThis.Blob !== 'undefined' && !globalThis.Blob.prototype.arrayBuffer) {
  const OriginalFile = globalThis.File;
  const OriginalBlob = globalThis.Blob;
  const OriginalFileReader = globalThis.FileReader;

  // Store the original Blob constructor for later use
  const jsdomBlob = OriginalBlob;

  // Create a wrapper that converts jsdom Blob/File to Node Blob when needed
  globalThis.Blob = NodeBlob as unknown as typeof Blob;

  // @ts-ignore - Wrap File to handle both jsdom and Node File operations
  globalThis.File = class PatchedFile extends NodeFile {
    constructor(bits: (string | Blob | ArrayBuffer | ArrayBufferView)[], filename: string, options?: FilePropertyBag) {
      super(bits, filename, options);
    }

    // Override slice to ensure it returns a Node Blob with arrayBuffer()
    slice(start?: number, end?: number, contentType?: string): Blob {
      const sliced = super.slice(start, end, contentType);
      return sliced; // super.slice already returns a Node Blob
    }
  };

  // Patch FileReader to handle Node Blobs by converting them back to jsdom Blobs
  // @ts-ignore
  globalThis.FileReader = class PatchedFileReader extends OriginalFileReader {
    readAsText(blob: Blob, encoding?: string) {
      if (blob instanceof NodeBlob && !(blob instanceof OriginalBlob)) {
        // Convert Node Blob to jsdom-compatible Blob synchronously using arrayBuffer()
        // Since Node Blobs are already in memory, this should be fast
        blob.arrayBuffer().then(buffer => {
          const jsdomCompatBlob = new jsdomBlob([buffer], { type: blob.type });
          super.readAsText(jsdomCompatBlob, encoding);
        });
        return;
      }
      return super.readAsText(blob, encoding);
    }

    readAsArrayBuffer(blob: Blob) {
      if (blob instanceof NodeBlob && !(blob instanceof OriginalBlob)) {
        // Convert Node Blob to jsdom-compatible Blob
        blob.arrayBuffer().then(buffer => {
          const jsdomCompatBlob = new jsdomBlob([buffer], { type: blob.type });
          super.readAsArrayBuffer(jsdomCompatBlob);
        });
        return;
      }
      return super.readAsArrayBuffer(blob);
    }
  };
}
