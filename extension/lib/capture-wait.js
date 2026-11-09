// Waiting for the first frame of a screen/tab capture. Chrome only paints a tab
// while it is showing, so a background tab picked in the share dialog sends no
// frames until the user switches to it — and a minimised window none until it
// is restored. `onSlow` fires once when that seems to be happening, so the
// extension can tell the user what to do instead of looking stuck.

/** Resolves when `video` has a frame; calls `onSlow` once after `slowMs`; rejects Error('no-frame') after `timeoutMs`. */
export function waitForFrame(video, { slowMs = 1200, timeoutMs = 120_000, pollMs = 100, onSlow = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let warned = false;
    const tick = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) { resolve({ waited: warned }); return; }
      const elapsed = Date.now() - started;
      if (!warned && elapsed >= slowMs) { warned = true; onSlow(); }
      if (elapsed >= timeoutMs) { reject(new Error('no-frame')); return; }
      setTimeout(tick, pollMs);
    };
    tick();
  });
}

/** What the user picked: 'browser' (a tab), 'window', 'monitor' or ''. */
export function surfaceOf(stream) {
  return stream?.getVideoTracks?.()[0]?.getSettings?.().displaySurface || '';
}
