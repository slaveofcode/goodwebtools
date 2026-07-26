# Optimize Desktop Screenshot Tool — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Each phase is an
> isolated commit that builds clean and keeps all automated tests green.

**Goal:** Make the desktop region-screenshot flow feel instant by eliminating
window-instantiation delay, IPC serialization overhead, and capture-before-show
latency — following the "pre-warmed architecture" pattern (Lark/Electron-style).

**Approved scope:** Phases A + B + C + D (all four).

**Architecture:** Pre-warm the region-selector window at startup and reuse it via
show/hide. Show it *first* (instant crosshair), then capture natively in a
background thread and inject the frozen background via a Tauri event + the asset
protocol (no base64/localStorage). Crop the selected region natively and return
only those bytes as a raw `tauri::ipc::Response` (no `number[]` JSON).

**Tech Stack:** Tauri 2, Rust (core-graphics), Astro overlay page, React island.

## Global Constraints
- Every phase must `cargo build` clean (0 errors) and keep `npm test` at 385+ green.
- Pure logic (crop math, asset-path building) gets Rust/TS unit tests — the live
  capture + window timing require **manual hardware smoke-testing** (called out per phase).
- Separate commit per phase so any phase can be reverted independently if a
  hardware test fails.
- The browser (non-Tauri) screenshot path must remain unchanged.

---

## ⚠️ Risk register (from this repo's git history)
- obs **8630**: an event-based screenshot-background approach was tried and
  **abandoned** in favor of a semi-transparent overlay. Phase C revives an
  event-based background — treat as the highest-risk phase; keep the localStorage
  fallback path until hardware-verified.
- obs **8199**: prior "window reuse → wrong display" bug. Phase A must reposition +
  resize the reused window on every show and assert the target display bounds.
- obs **8462 / 8981**: OS-level transparency caused a Cocoa `setOpaque_` crash and
  was removed from the countdown. Phase A/C transparency must be validated on macOS.

---

## Phase A — Pre-warm & reuse the region-selector window

**Files:** `src-tauri/src/main.rs`, `src-tauri/src/overlay.rs`, `src/pages/overlay.astro`

- Pre-create `region-selector` hidden in `main.rs` setup (decorations off,
  always-on-top, skip-taskbar, transparent, visible:false).
- `show_region_selector`: if the window exists, reposition to the target display
  bounds + resize + `.show()` + focus; only build as a fallback.
- `close_region_selector`: `.hide()` instead of `.close()` (keep it warm).
- `overlay.astro`: move init logic into a re-runnable `initOverlay()` and call it
  both on load *and* on a new `overlay-show` Tauri event (reset selection each show).

**Manual test:** trigger region screenshot twice; crosshair appears fast the 2nd
time; correct display; selection resets between uses.

## Phase B — Raw-bytes IPC + asset-protocol background

**Files:** `src-tauri/src/commands.rs`, `src/services/capture/tauri.ts`,
`src-tauri/src/overlay.rs` (temp-file write), `src/pages/overlay.astro`

- `capture_screen` / `capture_region` return `tauri::ipc::Response::new(bytes)`.
- `capture/tauri.ts`: read the response as `ArrayBuffer` → `Blob` (no `number[]`).
- Overlay background: write the downscaled JPEG to a temp file; overlay loads it
  via `convertFileSrc()` instead of base64→localStorage.

**Manual test:** capture on a 4K/5K display; no multi-second freeze; background
renders correctly.

## Phase C — Two-phase instant reveal

**Files:** `src-tauri/src/commands.rs` (new `trigger_region_capture`),
`src/pages/overlay.astro`, `src/islands/media/Screenshot.tsx`

- New command shows the pre-warmed window *immediately*, then
  `tauri::async_runtime::spawn` captures + writes the bg temp file and
  `emit('overlay-show', { displayId, bgPath })`.
- Overlay shows crosshair on transparent bg first; swaps in bg on the event.
- Keep localStorage fallback until hardware-verified.

**Manual test:** crosshair appears effectively instantly; background fills in a
beat later with no white flash.

## Phase D — Native server-side crop

**Files:** `src-tauri/src/commands.rs`, `src/pages/overlay.astro` /
`src/islands/media/Screenshot.tsx`

- Hold the full-res capture in an in-memory `Mutex<HashMap<String, CaptureBuf>>`
  keyed by capture id (set in Phase C's spawn).
- New `crop_capture(captureId, region)` crops natively (physical-pixel math moved
  server-side) → returns raw bytes via `tauri::ipc::Response`.
- Frontend stops shipping the full-res screen to JS; it receives only the crop.
- Unit-test the physical-pixel crop math (pure Rust fn).

**Manual test:** small-region grab on a HiDPI display is pixel-accurate and fast.

---

## Verification
- After each phase: `cargo build` (0 errors) + `npm test -- --run` (385+ green) +
  `cargo test` for any new pure-logic tests.
- Final: full manual smoke test on macOS (primary), note Windows/Linux as untested.
