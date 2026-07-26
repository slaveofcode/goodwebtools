// Browser stub for `node-fetch`. @tensorflow/tfjs-core declares node-fetch as a
// dependency for its Node platform; in the browser it uses the platform-browser
// fetch and never touches this, but Vite still resolves the import and chokes on
// node-fetch's CommonJS `whatwg-url` dependency. Aliasing node-fetch here (see
// astro.config.mjs `vite.resolve.alias`) maps it to the real browser fetch.
const fetchFn = (...args) => globalThis.fetch(...args);

export default fetchFn;
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
export class FetchError extends Error {}
export const AbortError = globalThis.DOMException;
