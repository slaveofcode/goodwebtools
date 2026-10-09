// Types for the vendored Emscripten factory (see needle.mjs).
declare function createNeedle(moduleArg?: { wasmBinary?: ArrayBuffer | Uint8Array; [k: string]: unknown }): Promise<unknown>;
export default createNeedle;
