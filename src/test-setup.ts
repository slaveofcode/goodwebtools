// Polyfill jsdom's Blob with Node's native Blob, which has arrayBuffer/text/stream.
// jsdom ships a partial Blob that lacks these standard methods.
import { Blob as NodeBlob } from 'node:buffer';

if (typeof globalThis.Blob !== 'undefined' && !globalThis.Blob.prototype.arrayBuffer) {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
}
