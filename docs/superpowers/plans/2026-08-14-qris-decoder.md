# QRIS Decoder Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a client-side QRIS (EMVCo) decoder: paste payload or QR image → summary + full TLV tree.

**Architecture:** Pure lib `qris.lib.ts` (CRC + TLV parse + summary); thin island `QrisDecoder.tsx` (jsQR image decode + render); registry + EN/ID SEO. No new deps.

**Tech Stack:** Astro + React island, Vitest, native JS, `jsqr` (already installed) for the image path.

## Global Constraints

- 100% client-side; parser is pure JS; image decode via already-installed `jsqr` (dynamic import).
- New tool `status: 'beta'`; Dev category; icon `Wallet`.
- SEO REQUIRED in EN + ID with `howTo`; Bahasa "tool" loanword, technical terms kept.
- Commit under personal noreply identity; no AI-attribution trailers; no absolute machine paths.

---

### Task 1: Pure lib `qris.lib.ts` (TDD)

**Files:** Create `src/tools/dev/qris.lib.ts`, Test `src/tools/dev/qris.lib.test.ts`.

**Interfaces produced:**
- `crc16(input: string): string`
- `Tlv = { id: string; length: number; value: string; name: string; children?: Tlv[] }`
- `parseTlv(s: string): Tlv[]`
- `parseQris(payload: string): { summary: QrisSummary; tree: Tlv[] }`
- `QrisSummary` (fields per spec)

- [ ] Failing tests: `crc16('123456789')==='29B1'`; `parseTlv('000201')` → one `{id:'00',length:2,value:'01'}`; nested tag 26 → children; malformed (`'0002'` truncated / bad len) → throws; `parseQris(<hand-built ASCII QRIS>)` → merchantName 'TOKO BUDI', city 'JAKARTA', nmid 'ID1020012345678', amount '12345', mcc '5411', currency '360', initiationMethod 'static', crcValid true; tampered last char → crcValid false; `parseQris('garbage!!')` → throws.
- [ ] Run — confirm fail.
- [ ] Implement lib (CRC-16/CCITT-FALSE; recursive TLV with nested templates 26–51/62/64; summary extraction incl. NMID from merchant-account sub-tag 02).
- [ ] Run — confirm pass.

### Task 2: Island `QrisDecoder.tsx`

**Files:** Create `src/islands/dev/QrisDecoder.tsx`.

- [ ] `TextArea` payload + `Dropzone` image + `usePasteImage`. Image → canvas → `getImageData` → `await import('jsqr')` → `.data` → setPayload. `useMemo` parse → result/error. Summary rows + CRC badge + `CopyButton`. Recursive TLV tree (indented children). i18n TR en+id. SSR-safe.

### Task 3: Register + SEO

**Files:** Modify `src/registry/tools.ts`, `src/registry/tool-seo.ts`.

- [ ] Import `Wallet`; add ToolDef.
- [ ] Add EN + ID `qris-decoder` SEO entries (title/description/intro/howTo/faqs).

### Task 4: Verify loop

- [ ] `npx vitest run` green · `npm run lint` 0 errors · `npm run build` succeeds; `/tools/qris-decoder` + `/id/…` built.
- [ ] Hand review: parser rejects malformed without hanging; CRC path; SSR; empty/partial payload; reference-identity of derived props.

### Task 5: Ship dev → prod

- [ ] Commit on `feat/qris-decoder`, PR → develop, CI green, merge.
- [ ] Promote develop → main (`--admin`), confirm Cloudflare prod build, verify live URL.
