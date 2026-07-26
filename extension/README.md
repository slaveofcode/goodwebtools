# GoodWebTools Companion (browser extension)

A thin **MV3 capability-shim** for [GoodWebTools](https://github.com/slaveofcode/goodwebtools).
The website does everything client-side; this extension only adds the few things a
web page physically **cannot** do:

- **Global hotkey** — capture the screen with <kbd>Ctrl/⌘ + Shift + Y</kbd> even
  while another application is focused.
- **Cross-window desktop capture** — grab any screen/window without the
  GoodWebTools tab needing focus, then **drag a crop region** and download or copy.
- **Page bridge** — the Screenshot tool detects the extension and offers an
  "Enhanced capture" button that hands the frame back to the web app's own crop
  pipeline.

Everything stays on your device. The extension uploads nothing and requests the
**narrowest permissions** per feature (`desktopCapture`, `offscreen`, `storage`,
`notifications`, `commands`) — no broad host access.

## How it works

```
Global hotkey ─▶ background.js ─▶ desktopCapture picker ─▶ offscreen.js (getUserMedia
                                                            + canvas grab) ─▶ select.html
                                                            (crop / download / copy)

Web app  ──postMessage──▶ content.js ──runtime msg──▶ background.js ─▶ capture
         ◀──postMessage── content.js ◀──── PNG dataURL ──── (app crops it itself)
```

- `background.js` — service worker: hotkey command, message routing, orchestrates
  the capture. No DOM, so it delegates the pixel grab to an offscreen document.
- `offscreen.js` — turns a `desktopCapture` stream id into a PNG via
  `getUserMedia` + `<canvas>`.
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

## Package for a store

```bash
cd extension
zip -r ../goodwebtools-companion.zip . -x '*.DS_Store'
```

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
