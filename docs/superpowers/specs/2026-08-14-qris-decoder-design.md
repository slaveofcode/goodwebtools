# QRIS Decoder — Design

**Date:** 2026-08-14
**Category:** Dev
**Tool id:** `qris-decoder`

## Goal

Decode an Indonesian QRIS code (EMVCo Merchant-Presented Mode QR) entirely in the browser and show the human-readable fields: merchant name, **NMID** (National Merchant ID), merchant city, amount, MCC, currency, static vs dynamic, acquirer, and **CRC validity** — plus a full tag-by-tag TLV breakdown. Nothing is uploaded.

## Input (confirmed with user)

- **Paste the payload string** (`00020101...`), OR
- **Drop / paste a QRIS QR image** → decode to the payload with `jsQR` (already a dependency; same engine as the existing QR Code Reader), then parse.

## Detail level (confirmed)

- **Summary** card of the key fields, plus an **expandable full TLV tree** (nested merchant-account template 26–51, additional-data template 62, language template 64).

## EMVCo / QRIS parsing (the core knowledge)

The payload is EMVCo TLV: each object is `ID(2) + LEN(2, decimal) + VALUE(LEN)`, concatenated. Root tags:
- `00` Payload Format Indicator · `01` Point of Initiation Method (`11`=static, `12`=dynamic)
- `26`–`51` Merchant Account Information (nested) — for QRIS: sub `00`=Globally Unique Identifier (e.g. `ID.CO.QRIS.WWW`), `01`=Merchant PAN, `02`=**NMID**, `03`=Merchant Criteria (UMI/UKE/UBE/URE)
- `52` MCC · `53` Currency (`360`=IDR) · `54` Amount · `55`–`57` tip/convenience
- `58` Country · `59` Merchant Name · `60` Merchant City · `61` Postal Code
- `62` Additional Data (nested: `01` bill, `05` reference, `07` terminal, …)
- `63` CRC · `64` Merchant Info — Language Template (nested)

**CRC** is CRC-16/CCITT-FALSE (poly `0x1021`, init `0xFFFF`) over the whole payload up to and including the CRC tag+length (`6304`), compared to the trailing 4 hex chars. Pinned by the standard check vector: `crc16('123456789') === '29B1'`.

## Architecture

### Pure lib — `src/tools/dev/qris.lib.ts` (framework-free, unit-tested)

- `crc16(input: string): string` — CRC-16/CCITT-FALSE, 4 upper-hex chars.
- `parseTlv(s: string): Tlv[]` — flat parse; throws on malformed (bad length / overrun). Nested templates parsed recursively (best-effort; a value that isn't clean TLV stays a leaf).
- `TAG_NAMES`, `SUBTAG_NAMES` — dictionaries; `Tlv = { id, length, value, name, children? }`.
- `parseQris(payload: string): { summary: QrisSummary; tree: Tlv[] }` — trims input, builds the tree, derives the summary, validates CRC. **Throws only on structurally invalid TLV**; a bad CRC is reported (`crcValid: false`), not thrown.
- `QrisSummary = { payloadFormat?, initiationMethod: 'static'|'dynamic'|'unknown', merchantName?, merchantCity?, postalCode?, countryCode?, currency?, amount?, mcc?, nmid?, merchantPan?, merchantCriteria?, acquirer?, crc?, crcValid }`.

### Island — `src/islands/dev/QrisDecoder.tsx` (default export)

- `TextArea` for the payload + `Dropzone accept="image/*"` (and `usePasteImage`) → canvas → `getImageData` → `await import('jsqr')` → `jsQR(...).data` → set payload. (Mirrors `QrRead.tsx`.)
- `useMemo` parse on the trimmed payload → result or error (`Alert`).
- **Summary** rendered as label→value rows (merchant, NMID, city, amount+currency, MCC, static/dynamic, acquirer) with a green/red **CRC valid** badge, plus a `CopyButton` for the payload.
- **Full TLV tree**: recursive labeled rows (`id · name` → value), children indented — modeled on `CronExplainer`'s labeled field boxes.
- i18n `TR` en + id (Bahasa: "tool" loanword, technical terms QRIS/NMID/MCC/CRC kept as-is). Signature `export default function QrisDecoder({ lang = 'en' }: { lang?: Lang })`. SSR-safe (jsQR + canvas only in handlers).

### Registry — `src/registry/tools.ts`

```ts
{
  id: 'qris-decoder',
  name: 'QRIS Decoder',
  category: 'Dev',
  route: '/tools/qris-decoder',
  keywords: ['qris', 'qr', 'emvco', 'payment', 'decode', 'nmid', 'merchant', 'indonesia', 'tlv'],
  icon: Wallet,
  summary: 'Decode a QRIS payment code — merchant, NMID, city, amount',
  load: () => import('@/islands/dev/QrisDecoder'),
  status: 'beta'
},
```
`Wallet` imported from `lucide-react` (exists).

### SEO — `src/registry/tool-seo.ts` (REQUIRED, both locales)

EN + ID `qris-decoder` with title/description/intro/**howTo**/faqs. Keywords: "QRIS decoder", "cek QRIS", "decode QRIS", "NMID QRIS", "baca QRIS". Bahasa uses "tool" loanword.

### No new dependency, no globIgnores change

`jsQR` is already installed and dynamic-imported; the parser is pure JS.

## Testing

`src/tools/dev/qris.lib.test.ts` — `crc16('123456789')==='29B1'`; `parseTlv` flat + nested + malformed-throws; `parseQris` on a hand-built ASCII QRIS (assert merchantName/city/nmid/amount/mcc/currency/initiationMethod, `crcValid: true`), tampered CRC → `crcValid: false`, garbage → throws. Island covered by build + manual smoke (jsQR/canvas can't run in jsdom).

## Definition of done

Spec+plan committed · `qris.lib.ts` unit-tested · EN + ID SEO with howTo · vitest + lint + build green · `/tools/qris-decoder` + `/id/…` built · merged to develop · promoted to main · Cloudflare prod build green · live URL verified · user told about PWA hard-refresh.
