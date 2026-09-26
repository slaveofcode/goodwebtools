# Tool Error Reporting — Design Spec

**Date:** 2026-09-26
**Status:** Approved (design); pending spec review before planning
**Type:** Architectural (cross-cutting subsystem + new Worker endpoint + new R2 bucket)

## Problem

When a tool fails for a real user, we currently have no way to learn about it. The
trigger case: a user tried the **image-compress** tool with a `.jpeg` and got an
error instead of a result — and we only heard about it by word of mouth, with no
environment info, no logs, and no failing file. Most tool failures surface as a
handled error (`catch (e) { setError(…) }` → `<Alert variant="error">`), a few as
uncaught render/hydration crashes (caught by `ToolErrorBoundary`). Neither is
reported anywhere.

We want an **opt-in, consent-gated problem reporter** available on every tool page
that, on any failure, lets a willing user send a rich diagnostic report — browser,
device, capabilities, a full log/breadcrumb trail, the caught error, and
(optionally) the exact failing file — so we can reproduce and fix it. It must
specifically close the **"works on my machine"** gap by capturing enough
environment + log detail to explain failures we can't reproduce locally.

## Goals

- A "Report a problem" entry point on **every** tool page (one `ToolHost` change).
- Capture **both** failure classes: handled operational errors and uncaught crashes,
  plus global `window` errors / unhandled rejections.
- A **comprehensive diagnostics + log** payload that closes "works on my machine".
- The **exact failing file** auto-attached for wired hot tools; manual attach for the rest.
- Strong **privacy posture**: nothing sent without explicit consent; the file is a
  separate, extra-warned, opt-in attachment; reports are private, retention-limited.
- Abuse-resistant public endpoint (Turnstile + size cap + rate limit).
- A warm **thank-you** confirmation after submit.
- We (the maintainer) can **triage** reports: private R2 + a token-gated admin viewer + optional webhook ping.

## Non-goals

- No auto-upload of anything without an explicit click + consent.
- No scanning/scrubbing of file **contents** for PII — we **warn** instead.
- No public GitHub issues (repo is public; reports can contain PII/files).
- No third-party analytics or error-tracking SaaS (privacy; keep it same-origin).
- Not retrofitting all ~192 tools' handled-error paths in one sweep (see Rollout).

## Decisions (from brainstorming)

1. **Destination:** Worker ingest → **private R2**. File attachment optional-on-consent.
2. **Coverage:** Entry point on every page + global/crash/breadcrumb capture everywhere;
   auto file+error capture only for **wired** hot tools (image-compress first, then
   redact, OCR, receipt, converters). New tools must wire in (enforced by gwt-add-tool).
3. **Triage:** R2 + token-gated in-app **admin viewer** + optional webhook ping
   (webhook URL is a Cloudflare secret, never committed).
4. **Abuse protection:** Cloudflare **Turnstile** + file size cap (**10 MB**) + per-IP rate limit.
5. **Retention (default, open to change at spec review):** auto-delete reports after **30 days**.
6. **Rollout (default):** ship **Sub-project A (MVP)** first; **Sub-project B** (admin viewer,
   webhook, retention lifecycle, remaining wiring, enforcement) follows.

> Open for spec review: (a) retention window (30 days?), (b) whether the admin viewer
> must be in the first release or can follow in Sub-project B.

## Architecture & data flow

```
Tool island ──(breadcrumbs + registers current File via useReportable)──▶ reporter bus (client)
   │  handled error (setError)      ┐
   ToolErrorBoundary crash ─────────┤► openReportDialog(prefill)
   window.onerror/unhandledrejection┘
ReportDialog ──multipart POST──▶ Worker /api/report
                                   ├─ verify Turnstile token
                                   ├─ enforce size cap + per-IP rate limit (Durable Object counter)
                                   ├─ write reports/<yyyy>/<mm>/<id>/report.json (+ file.<ext>)
                                   └─ optional webhook ping (REPORT_WEBHOOK_URL secret)
Maintainer ──token──▶ /admin/reports (noindex) ──▶ /api/admin/reports (bearer) ──▶ list/read/delete R2
```

New infra:
- **R2 bucket** `goodwebtools-reports` (+ `goodwebtools-reports-staging`), binding `REPORTS`.
- **Secrets** (Cloudflare, never in repo): `TURNSTILE_SECRET`, `ADMIN_REPORT_TOKEN`,
  optional `REPORT_WEBHOOK_URL`.
- **Public build var** `PUBLIC_TURNSTILE_SITE_KEY` (public; fine to commit reference), and a
  new **`PUBLIC_BUILD_SHA`** injected at build for the diagnostics `build` field.
- Everything else reuses the existing `worker/index.js` prefix-dispatch pattern
  (precedent: `/api/llm-proxy` POST ingest, `/models/*` R2 serving).

## Components

### Client services (SSR-safe; client-only init, all `typeof window` guarded)

- **`src/services/report/breadcrumbs.ts`** — bounded ring buffer (cap ~200 entries).
  Captures `console.warn`/`console.error` (patched, message length-capped), `window`
  `error` and `unhandledrejection`, and exposes `breadcrumb(action: string, data?: Record<string, unknown>)`
  for structured step logging. Stores **metadata only**, never file bytes. Pure,
  bounded, unit-tested for eviction + size cap.
- **`src/services/report/diagnostics.ts`** — `collectDiagnostics(): Diagnostics`
  (schema below). Reads `navigator`/`window`/`screen` behind guards; each probe
  wrapped so one failure can't blank the whole payload.
- **`src/services/report/fileMeta.ts`** — `sniffFileMeta(file: File): Promise<FileMeta>`:
  claimed MIME + **actual format via magic bytes** (JPEG/PNG/GIF/WEBP/HEIC/PDF/…),
  size, lastModified; for images, attempts `createImageBitmap` and records
  decode success + dimensions. Pure logic + table-driven tests (covers the
  `.jpeg`-that-is-actually-HEIC/CMYK/corrupt cases).
- **`src/services/report/reporter.ts`** — the bus. Holds current tool context
  `{ toolId, getFile?: () => File | null, extra?: Record<string, unknown> }`,
  `setLastError(err)`, and `openReportDialog(prefill?)` (drives a lightweight store the
  dialog subscribes to). Lets the report UI (rendered in `ToolHost`, outside the island)
  fetch the exact current `File`.
- **`src/services/report/submit.ts`** — `buildReportForm()` (assembles multipart:
  `report.json` + optional file + turnstile token) and `submitReport()` (POST, returns
  `{ id }` or a typed error). No secrets client-side.

### Client hooks / UI

- **`src/hooks/useReportable.ts`** — one-line opt-in for a tool island:
  `useReportable({ toolId, file, extra })` registers the current `File` getter + extra
  context and clears on unmount. Wired tools call it; also route caught errors through
  `reporter.setLastError(e)` (or a shared `<ErrorAlert onReport>`).
- **`src/islands/report/ReportButton.tsx`** — the persistent "Report a problem"
  affordance. **Rendered by `ToolHost` on every tool page.**
- **`src/islands/report/ReportDialog.tsx`** — the modal: optional "What were you doing?"
  textarea; collapsible **"See exactly what will be sent"** (renders diagnostics JSON);
  **consent checkbox** (send diagnostics + logs); a **separate, pre-unchecked "Attach my
  file"** with a sensitivity warning; invisible Turnstile widget; Submit; and the
  **thank-you** success state.
- **`src/islands/ToolHost.tsx`** — (1) render `<ReportButton>` under every tool;
  (2) the `ToolErrorBoundary` fallback gets a prominent "Report this crash" button that
  calls `openReportDialog({ error })`; (3) install the global `error`/`unhandledrejection`
  listeners once (feeding breadcrumbs + `setLastError`).

### Worker (`worker/index.js`)

- **`POST /api/report`** (multipart/form-data):
  1. Verify Turnstile token against `TURNSTILE_SECRET` (Cloudflare siteverify).
  2. Enforce `file ≤ 10 MB` + a total-body cap; **per-IP rate limit** via a small
     Durable Object counter (reuse the DO pattern already used by `SignalRoom`).
  3. Write `reports/<yyyy>/<mm>/<reportId>/report.json` and, if attached,
     `…/file.<ext>` to `REPORTS`. Never log bytes (mirrors the llm-proxy no-log rule).
  4. Optional `REPORT_WEBHOOK_URL` ping (title/toolId/error summary — no PII/file).
  5. Return `{ id: reportId }`.
  The request handler is factored as a **pure `handleReport(request, env)`** so it can be
  unit-tested with mocked `env` (Turnstile fetch + R2 `put`).
- **`GET/DELETE /api/admin/reports`** (Sub-project B): bearer `ADMIN_REPORT_TOKEN`;
  list (R2 `list` with prefix + pagination), read one, delete one.

### Admin viewer (Sub-project B)

- **`/admin/reports`** — a `noindex`, non-registry Astro page. Prompts for the admin
  token (stored in `localStorage`, never shipped in the build). Lists reports (newest
  first), opens a report's diagnostics JSON, downloads the attached file, and
  deletes / marks resolved. Talks only to `/api/admin/reports`.

## Diagnostics schema (the "works on my machine" killer)

`Diagnostics` (all fields best-effort; a failed probe is omitted, never fatal):

- **app**: `reportId`, `timestamp`, `build` (`PUBLIC_BUILD_SHA`), `toolId`, `route`, `locale`.
- **browser/os**: `userAgent`, `userAgentData` (platform, mobile, full version list),
  `deviceMemory`, `hardwareConcurrency`, `languages`, `timezone`.
- **display**: `screen` (w/h), `devicePixelRatio`, `viewport` (w/h), `orientation`,
  `colorScheme`, `prefersReducedMotion`.
- **capabilities**: `wasm`, `wasmSimd`, `wasmThreads`/`crossOriginIsolated`
  (`SharedArrayBuffer`), `offscreenCanvas`, `webgl`, `webgl2`, `webgpu`, `webCodecs`,
  `createImageBitmap`, `storage` (localStorage + IndexedDB availability → private-mode
  signal), `connection` (effectiveType, downlink, saveData), `online`.
- **error**: `name`, `message`, trimmed `stack`, `causeChain[]`.
- **file** (present whenever a `File` is in context, **even if not attached**): from
  `sniffFileMeta` — `claimedType`, `actualFormat` (magic bytes), `size`, `lastModified`,
  and for images `decodeOk` + `width`/`height`.
- **logs**: `breadcrumbs[]` (timestamped actions + captured console) and
  `consoleErrors[]` since load.
- **user**: optional free-text `message`.

> The **file** block alone frequently explains image failures (e.g. a `.jpeg` that is
> actually HEIC/CMYK/corrupt, or a browser lacking a decoder) **without uploading the file**.

## Consent, privacy & thank-you

- **Two-tier consent**: (1) always-shown consent to send diagnostics + logs;
  (2) a **separate, pre-unchecked** "Attach my file" with a plain-language warning that
  the file may contain personal/financial data.
- **Transparency**: collapsible "See exactly what will be sent" renders the diagnostics JSON.
- **Consent copy** states plainly: reports are private, never shared or sold, used only
  to fix the error, and auto-deleted after the retention window.
- **Thank-you state** on success: warm, appreciative — e.g. *"Thank you — your report
  helps us fix this for everyone hitting the same error."* — plus the report id.
- Reflect the reporter in the **Privacy page** copy (EN + ID): what's collected, when,
  that it's opt-in, and retention.

## Security & abuse

- Turnstile gate + size cap + per-IP rate limit on the public endpoint.
- Private bucket; admin bearer token; all secrets via Cloudflare (never committed —
  honors the repo identity rules).
- File **bytes never logged**; retention auto-purge (lifecycle rule).
- Magic-byte sniffing is **client-side** (diagnostics), so the Worker never parses file
  contents — no server-side file-parsing attack surface. The Worker only streams bytes to R2.

## Testing

- **Unit (Vitest, `src/**`)**: breadcrumb ring buffer (eviction, size cap, redaction);
  `collectDiagnostics` (mock `navigator`/`window`/`screen`); `sniffFileMeta`
  (table-driven magic-byte cases incl. JPEG/HEIC/CMYK/corrupt); reporter bus
  (register/getFile/setLastError/open); `buildReportForm`; and a **pure
  `handleReport(request, env)`** with mocked Turnstile + R2.
- **E2E (Playwright, `e2e/`)**: on a tool page, trigger an error → open the dialog →
  submit against a **dev-only stubbed endpoint** (`?e2e` hook, `import.meta.env.DEV`,
  stripped from prod) → assert the thank-you state; plus a global-crash path via
  `ToolErrorBoundary`. Wired-tool case: image-compress auto-attaches the file.
- **Manual**: real submit to staging R2; confirm object layout + retention rule + admin read.

## Rollout (YAGNI — staged, each PR shippable)

- **Sub-project A (MVP — this spec's first plan)**: breadcrumbs + diagnostics + fileMeta
  + reporter bus + `ReportButton`/`ReportDialog` + `ToolHost` integration +
  `POST /api/report` (Turnstile + caps + R2) + consent + thank-you + **wire
  image-compress first**, then redact/OCR/receipt/converters. Reports inspected via
  `wrangler` initially.
- **Sub-project B**: admin viewer + `/api/admin/reports` + webhook ping + R2 retention
  lifecycle + wire remaining hot tools + gwt-add-tool enforcement + Privacy-page copy.

## File inventory (new/changed)

New: `src/services/report/{breadcrumbs,diagnostics,fileMeta,reporter,submit}.ts` (+ tests),
`src/hooks/useReportable.ts`, `src/islands/report/{ReportButton,ReportDialog}.tsx`,
`e2e/tools/report.spec.ts` (+ generic fixture), `docs/superpowers/specs/2026-09-26-tool-error-reporting-design.md`.
Changed: `worker/index.js` (+ `/api/report`, later `/api/admin/reports`),
`wrangler.jsonc` (+ `REPORTS` R2 binding, prod + staging), `astro.config.mjs`
(inject `PUBLIC_BUILD_SHA`), `src/islands/ToolHost.tsx`, `src/islands/image/*` (wire
image-compress first), the Privacy page (EN + ID, Sub-project B).

## Success criteria

- From a tool error, a consenting user can submit a report in a few clicks; the
  thank-you state confirms it.
- A text-only report (no file) already carries enough environment + log detail to
  diagnose a "works on my machine" failure — demonstrated on the image-compress case.
- Nothing leaves the device without explicit consent; the file is a distinct opt-in.
- The public endpoint resists bot spam (Turnstile) and oversized/abusive uploads.
- Reports are retrievable and triageable by the maintainer; auto-purged after retention.
