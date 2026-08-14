# NIK / KTP Decoder — Spec + Plan

**Date:** 2026-08-14 · Category: Dev · id: `nik-decoder`

## Goal
Validate an Indonesian **NIK** (16-digit Nomor Induk Kependudukan / KTP number) and break out its structure — province, regency & district codes, birth date, gender, and serial — entirely client-side. Zero uploads.

## NIK structure (16 digits)
`PP KK CC | DD MM YY | SSSS`
- `PP` province code (2) → mapped to province name (38-province table, incl. 2022 additions).
- `KK` regency/city code (2), `CC` district/kecamatan code (2) — shown as codes (full name mapping needs the ~80k-row Kemendagri dataset, out of scope; codes + province name are the useful, embeddable part).
- `DD MM YY` birth date. **Female → day + 40** (so `DD` 41–71 means female, real day = DD−40).
- `SSSS` computer-generated serial (0001–9999).
- No checksum digit → validation is structural (length, digits, known province, valid month/day).

## Architecture
### Pure lib `src/tools/dev/nik.lib.ts`
- `PROVINCES: Record<string,string>` (province code → name).
- `parseNik(nik: string, currentYear: number): NikResult` — pure, `currentYear` passed in (island passes `new Date().getFullYear()`) so the century heuristic stays deterministic/testable.
- Century: `fullYear = 2000+yy <= currentYear ? 2000+yy : 1900+yy`.
- `NikResult = { valid: boolean; issues: string[]; provinceCode; province; regencyCode; districtCode; gender: 'male'|'female'; birthDate: { day; month; year } | null; birthDateISO: string | null; serial; }`.
- Validates: 16 digits; province in table (else issue, still decodes); month 1–12; real day 1–31.

### Island `src/islands/dev/NikDecoder.tsx`
Input (controlled, digit-filtered) → `useMemo(parseNik(value, new Date().getFullYear()))` → validity badge + labeled rows (province, regency code, district code, gender, birth date, age, serial) + `CopyButton`. Example button. i18n TR en+id. SSR-safe.

### Registry + SEO
`tools.ts` ToolDef (icon `SquareUser`). EN + ID `nik-decoder` SEO (title/description/intro/howTo/faqs). Keywords: "cek NIK", "decode NIK KTP", "NIK validator", "arti NIK". Bahasa "tool" loanword. **Privacy note in copy/UI:** decoding is local; nothing is uploaded (important for PII).

## Testing
`nik.lib.test.ts`: valid male NIK → fields; female (day+40) → gender female + corrected day; province lookup; century heuristic (pass fixed currentYear); invalids (length, non-digit, month 13, day 00) → issues; unknown province flagged.

## Definition of done
Spec+plan committed · lib unit-tested · EN+ID SEO w/ howTo · vitest+lint+build green · `/tools/nik-decoder` + `/id/…` built · develop → main → live verified · PWA hard-refresh note.
