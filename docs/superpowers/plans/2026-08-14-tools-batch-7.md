# Seven-Tool Batch — Spec + Plan

**Date:** 2026-08-14. One branch (`feat/tools-batch-7`), one PR → develop, bundled prod promotion.

All client-side. Each tool: pure lib (+ Vitest) where there's real logic, thin island, registry entry, **EN + ID SEO with howTo**. Bahasa uses "tool" loanword.

## Global Constraints
- Commit under personal noreply identity; no AI-attribution trailers; no absolute machine paths.
- Heavy deps dynamic-imported in the lib + chunk added to `workbox.globIgnores`.
- New tools `status: 'beta'`.

## Tools

### 1. CIDR Calculator (`cidr-calculator`, Dev, icon `Network`)
Pure lib `src/tools/dev/cidr.lib.ts`: `parseCidr('192.168.1.0/24')` → network, broadcast, netmask, wildcard, first/last host, host count, /prefix. IPv4. Unit-tested (parse, edge /31 /32, invalid). Island: input → summary rows + Copy.

### 2. Hash Text (`hash-text`, Dev, icon `Hash`)
Lib `src/tools/dev/hash-text.lib.ts`: `hashText(text, algo)` via `hash-wasm` one-shot (md5/sha1/sha256/sha512/crc32), `ALGORITHMS` list. Dynamic-import hash-wasm. Tested with a known vector (`sha256('abc')`). Island: textarea → all-algos or selected → rows + Copy.

### 3. SRT/VTT Editor (`subtitle-editor`, Media, icon `Subtitles`)
Lib `src/tools/media/subtitle.lib.ts`: `parseSubtitles(text)` (auto-detect SRT vs VTT) → `Cue[] = {index,start,end,text}`; `toSrt(cues)`, `toVtt(cues)`, `formatTimestamp`. Unit-tested (round-trip, cross-convert, malformed tolerance). Island: paste/upload → editable cue list + convert + download .srt/.vtt.

### 4. HTML/CSS/JS Minifier (`minifier`, Dev, icon `Minimize2`)
Lib `src/tools/dev/minify.lib.ts`: `minifyCss(css)` (csso, dynamic), `minifyJs(js)` (terser, dynamic, async), `minifyHtml(html)` (hand-rolled: strip comments, collapse inter-tag whitespace, preserve `<pre>/<textarea>/<script>/<style>`). HTML minifier unit-tested (pure). Add `**/terser*.js`, `**/csso*.js` to globIgnores. Island: language tabs (HTML/CSS/JS) → minify → output + size delta + Copy/Download.

### 5. Voice Recorder (`voice-recorder`, Media, icon `Mic`)
Island `src/islands/media/VoiceRecorder.tsx` consumes existing `useAudioRecorder` hook: record → timer → `<audio controls>` playback (with the `duration=Infinity` seek fix) → download `recording.webm`. No new lib (hook already tested). Permission errors via `Alert`.

### 6. Extract Images from PDF (`pdf-extract-images`, PDF, icon `FileImage`)
Lib `src/tools/pdf/extract-images.lib.ts`: via `pdfjs-dist` — `getOperatorList` per page, collect `OPS.paintImageXObject` names, resolve `page.objs.get(name)` → draw to canvas → PNG blob; dedupe by name. Returns `{name, blob, width, height}[]`. Dynamic-import pdfjs (already globIgnored region). Island: Dropzone(pdf) → grid of images, per-image download + ZIP-all (`downloadService.downloadZip`). Pure helpers (dedupe/name) unit-tested; pdfjs path smoke-only.

### 7. PPTX Viewer (`pptx-viewer`, Documents, icon `Presentation`)
Lib `src/tools/documents/pptx.lib.ts` mirroring `odt.lib`: `fflate.unzipSync` → read `ppt/slides/slideN.xml` (ordered via `ppt/presentation.xml` / slide rels), parse with `DOMParser`, extract text runs (`a:t`) + basic structure into a safe HTML string per slide (escaped); map `ppt/media/*` for images (best-effort). Honest fidelity: text + images + layout order, NOT pixel-perfect rendering. Unit-tested (parse a synthetic minimal pptx built with fflate `zipSync`). Island mirrors `OdtViewer`: dynamic-import lib, render slides via `dangerouslySetInnerHTML` into styled slide frames, slide nav, Print.

## Verify + Ship
Per tool: failing test → implement → pass. Then full `vitest + lint + build` green; both `/tools/<id>/` and `/id/` built for all 7. One PR → develop → merge → promote develop→main (bundles PR #206 + these 7) → verify each live URL.
