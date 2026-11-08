# GoodWebTools Companion (browser extension)

The companion extension for [GoodWebTools](https://github.com/slaveofcode/goodwebtools).
The website does all the work client-side; the extension adds what a web page
physically **cannot** do:

- **Right-click menus** — send an image (compress, convert, resize, remove
  background, OCR, read QR, upscale), selected text (format/view JSON, Base64,
  hash, word count, read aloud, QR) or a link/page URL (QR) straight into the
  matching tool, already loaded.
- **Tool launcher** — the toolbar popup searches all tools (English and Bahasa
  Indonesia names and keywords), keeps ★ favorites and recents, and has quick
  actions (QR code of the current page, screen capture).
- **Side panel** — a GoodWebTools tool next to any page (Music Player, JSON
  Viewer, Notepad, Unit Converter… pin your own). The panel stays open while you
  switch tabs, so music keeps playing as you browse. Tools load in the site's
  compact embed mode (`?embed=1`).
- **Recording** — record the current tab with its sound (no picker, and you keep
  hearing it), or a screen/window; optionally include your microphone. Start/stop
  from the popup or with <kbd>Alt + Shift + R</kbd>; a red REC badge shows while it
  runs. The result page previews the video, downloads it (.webm) or as an animated
  GIF made right there (first 30 s, 10 fps, up to 480 px wide; `vendor/gifenc.js`),
  and hands it to the site's Video Converter (MP4), Video → GIF or Video Compressor.
  The full-page screenshot page can also copy the image to the clipboard.
- **This page** — a color picker (click anywhere on screen; copy HEX/RGB/HSL),
  save the page's images (pick, optionally convert to WebP/PNG/JPG, download as a
  zip) and its video and audio (`<video>`/`<audio>`, media links, og:video/audio and
  media the page fetched; HLS `.m3u8` streams are joined into one file; encrypted or
  live streams, and YouTube/SoundCloud, are not supported), and a full-page scrolling screenshot (download, or open in the Image
  Annotator / Compressor / Images → PDF). Fixed headers are shown once, not on
  every screen.
- **Data files** (optional) — on JSON (API responses, .json/.jsonl), YAML, TOML
  and Markdown files shown as plain text, a small bar offers to open the file in
  its viewer; with "Open them automatically" the viewer replaces the tab (not when
  you come back with the Back button). Turn it on in the popup; it needs site access.
- **Protected media** — players with DRM keys (EME, e.g. Spotify, Netflix) or
  `controlslist="nodownload"` are never offered by "Save images & media".
- **Global hotkey screenshot** — capture the screen with <kbd>Ctrl/⌘ + Shift + Y</kbd>
  even while another application is focused, then drag a crop region.
- **Page bridge** — the Screenshot tool's "Enhanced capture" uses the extension.

Everything stays on your device: data handed to a tool goes from the extension to
the open GoodWebTools tab through the page, never to a server. Permissions are kept
narrow — `contextMenus`, `activeTab`, `scripting`, `storage`, `notifications`,
`tabCapture`, `offscreen`, `sidePanel`, host access to goodwebtools.com only, and **optional**
access to other sites (asked for the first time an image action needs it, or via
the popup's "Allow images from websites" button).

### Handoff (right-click → tool)

```
menu click ─▶ background.js reads the image / selection / URL
            ─▶ stores it under a random single-use id (lib/handoff-store.js, 5 min TTL)
            ─▶ opens https://goodwebtools.com/tools/<tool>/#gwt-handoff=<id>
tool page  ─▶ postMessage handoff-get ─▶ content.js ─▶ background ─▶ payload
            ─▶ src/services/companion-handoff.ts loads it into the tool's file input / text box
```

## How it works

```
Global hotkey ─▶ background.js ─▶ offscreen.js (Chrome's picker via getDisplayMedia
                                                + canvas grab) ─▶ select.html
                                                            (crop / download / copy)

Web app  ──postMessage──▶ content.js ──runtime msg──▶ background.js ─▶ capture
         ◀──postMessage── content.js ◀──── PNG dataURL ──── (app crops it itself)
```

- `background.js` — service worker: hotkey command, message routing, orchestrates
  the capture. No DOM, so it delegates the pixel grab to an offscreen document.
- `offscreen.js` — shows Chrome's screen/window picker (`getDisplayMedia`;
  a service worker can't) and turns the choice into a PNG via `<canvas>`, or records it.
- `content.js` — injected only on GoodWebTools origins; bridges the page to the
  worker with `window.postMessage` (id-agnostic, so unpacked builds work).
- `select.html/js/css` — the region-select overlay for hotkey captures.
- `popup.html/js` — a capture button + the current hotkey.

## Install (unpacked, for testing / self-host)

1. Visit `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. **Load unpacked** → select this `extension/` folder.
4. (Optional) set/change the hotkey at `chrome://extensions/shortcuts`.

Works in Chrome / Edge / Brave / other Chromium browsers (MV3, Chrome ≥ 116).

## Chrome Web Store

Listing text (EN + ID), permission justifications, data-usage answers and the
submission steps are in [`store/LISTING.md`](store/LISTING.md); the screenshots and
promo tile are in `store/` (regenerate with `node scripts/store-assets.mjs`). The
privacy policy is the "Browser extension" section of https://goodwebtools.com/privacy#extension.

## Package for a store

```bash
npm run build                    # refreshes dist/tools-index.json
node scripts/pack-extension.mjs  # → dist-extension/goodwebtools-companion-<version>.zip
```

For local development, point the extension at the dev server from the service
worker console: `chrome.storage.local.set({ gwtBase: 'http://localhost:4321' })`.

Upload the zip to the Chrome Web Store / Edge Add-ons dashboard. When published,
add the store origin nothing else is needed — the content-script bridge already
matches `goodwebtools.com`, `*.workers.dev`, and `localhost`.

## Notes & limits

- The desktop **picker still appears** on capture — that's a browser security
  requirement and cannot be suppressed. The extension's value is the *global
  hotkey* and *cross-window* capture, not skipping the picker.
- **DRM/protected content** captures as black (browser rule).
- To broaden allowed origins, edit `content_scripts[].matches` and
  `externally_connectable.matches` in `manifest.json`.
