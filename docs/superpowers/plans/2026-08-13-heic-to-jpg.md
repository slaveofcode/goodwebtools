# HEIC → JPG Converter Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a client-side HEIC/HEIF → JPG batch converter to GoodWebTools.

**Architecture:** Pure lib (`heic.lib.ts`) does detection + filename + decode; thin island (`HeicToJpg.tsx`) does batch UI, quality slider, per-file `ImageResult`, ZIP-all. Registry + SEO + globIgnores wire it in.

**Tech Stack:** Astro + React island, Vitest, `heic-to` (libheif-wasm), `fflate` via `createZip`.

## Global Constraints

- Everything client-side; no server calls.
- Heavy dep dynamic-imported inside the lib; chunk added to `workbox.globIgnores`.
- New tool `status: 'beta'`.
- Bahasa copy uses "tool" loanword, never "alat".
- Commit under the personal noreply identity; no AI-attribution trailers; no absolute machine paths in committed files.

---

### Task 1: Install `heic-to`

- [ ] `npm install heic-to@^1.5.2 --save` (repo `.npmrc` sets legacy-peer-deps).
- [ ] Confirm it appears in `package.json` dependencies.

### Task 2: Pure lib `heic.lib.ts` (TDD)

**Files:** Create `src/tools/image/heic.lib.ts`, Test `src/tools/image/heic.lib.test.ts`.

**Interfaces produced:**
- `isLikelyHeic(file: { name: string; type: string }): boolean`
- `jpegName(originalName: string): string`
- `heicToJpeg(file: File, quality: number): Promise<Blob>`

- [ ] Write failing tests: `isLikelyHeic` true for `photo.heic`, `IMG.HEIF`, `x.heic` with empty type, MIME `image/heic`/`image/heif`; false for `photo.jpg`, `a.png`, `notes.txt` with empty type. `jpegName`: `IMG_1.heic`→`IMG_1.jpg`, `a.HEIC`→`a.jpg`, `noext`→`noext.jpg`, `my.photo.heif`→`my.photo.jpg`.
- [ ] Run — confirm fail (module not found).
- [ ] Implement lib. `heicToJpeg` dynamic-imports `heic-to`; `isLikelyHeic`/`jpegName` pure.
- [ ] Run — confirm pass.

### Task 3: Island `HeicToJpg.tsx`

**Files:** Create `src/islands/image/HeicToJpg.tsx`.

- [ ] Build UI mirroring `ImageConvert.tsx`: `Dropzone multiple`, quality slider, `ProgressBar` (percent = done/total), per-file `ImageResult`, "Download all as ZIP" via `createZip` + `ResultActions`/`downloadService`. i18n TR en+id. Filter non-HEIC via `isLikelyHeic` with an `Alert` note. Per-file try/catch so one failure doesn't abort the batch. SSR-safe.

### Task 4: Register + SEO + globIgnores

**Files:** Modify `src/registry/tools.ts`, `src/registry/tool-seo.ts`, `astro.config.mjs`.

- [ ] Import `ImageDown` in `tools.ts` (if not already) and add the ToolDef.
- [ ] Add EN + ID `image-heic-to-jpg` entries to `tool-seo.ts`.
- [ ] Add `'**/heic-to*.js'`, `'**/libheif*.js'` to `workbox.globIgnores`.

### Task 5: Verify loop

- [ ] `npx vitest run` green.
- [ ] `npm run lint` 0 errors.
- [ ] `npm run build` succeeds; `/tools/image-heic-to-jpg` built; no precache-size warning.
- [ ] Hand review: objectURL cleanup in island, reference-identity of derived props, error/empty paths.

### Task 6: Ship dev → prod

- [ ] Commit on `feat/heic-to-jpg`, PR → develop, CI green, merge.
- [ ] Promote develop → main (`--admin`), confirm Cloudflare prod build, verify live URL.
