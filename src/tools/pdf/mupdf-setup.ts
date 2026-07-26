// Point mupdf's Emscripten loader at the same-origin wasm in /public, instead
// of its default `new URL(..., import.meta.url)` resolution which is unreliable
// inside a Vite-bundled worker (and would otherwise hang the top-level await).
//
// This MUST be imported before `mupdf` so the global is set before mupdf's
// module-level `await libmupdf_wasm(...)` runs.
(globalThis as unknown as { $libmupdf_wasm_Module?: unknown }).$libmupdf_wasm_Module = {
  locateFile: (path: string) => (path.endsWith('.wasm') ? '/mupdf-wasm.wasm' : path),
};

export {};
