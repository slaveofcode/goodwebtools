import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

// jsdom ships a partial Blob/File that lack arrayBuffer/text/stream. Back Blob
// and File with Node's implementations (which have them), and bridge jsdom's
// FileReader — which only accepts jsdom-native blobs — by copying a Node blob's
// bytes into a jsdom Blob before reading.
if (typeof globalThis.Blob !== 'undefined' && !globalThis.Blob.prototype.arrayBuffer) {
  const JsdomBlob = globalThis.Blob;
  const OriginalFileReader = globalThis.FileReader;

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
}
