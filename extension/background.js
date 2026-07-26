// GoodWebTools Companion — service worker.
//
// Responsibilities:
//   1. Global hotkey (commands API) → capture the screen → open the region-select
//      overlay so the user can crop / download / copy, even while another app is
//      focused. This is the capability a web page cannot have.
//   2. Bridge for the web app: content.js relays a "capture" request here; we grab
//      a full-screen frame and hand the PNG back for the app's own crop pipeline.
//
// The actual pixel grab needs a DOM (getUserMedia + canvas), which a service
// worker doesn't have — so we run it in an offscreen document.

const OFFSCREEN_PATH = 'offscreen.html';

async function hasOffscreen() {
  // getContexts is available in Chrome 116+.
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
    return contexts.length > 0;
  }
  return false;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['DISPLAY_MEDIA', 'USER_MEDIA'],
    justification: 'Grab a frame from the chosen screen/window for a screenshot.',
  });
}

/** Show the desktop picker and return a media stream id (or null if cancelled). */
function chooseDesktopMedia() {
  return new Promise((resolve) => {
    chrome.desktopCapture.chooseDesktopMedia(['screen', 'window'], (streamId) => {
      resolve(streamId || null);
    });
  });
}

/** Ask the offscreen document to turn a streamId into a PNG data URL. */
async function grabFrame(streamId) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({ target: 'offscreen', type: 'grab', streamId });
}

/**
 * Full capture flow: pick source → grab frame.
 * Returns { dataUrl, width, height } or throws.
 */
async function capture() {
  const streamId = await chooseDesktopMedia();
  if (!streamId) throw new Error('cancelled');
  const res = await grabFrame(streamId);
  if (!res || res.error) throw new Error(res?.error || 'grab-failed');
  return res;
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
    });
  } catch {
    /* notifications are best-effort */
  }
}

// --- Global hotkey → capture → open the crop overlay -------------------------
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'capture-screenshot') return;
  try {
    const shot = await capture();
    // Stash the capture for the overlay page (data URLs are too big for a query string).
    await chrome.storage.session.set({ pendingCapture: shot });
    await chrome.tabs.create({ url: chrome.runtime.getURL('select.html') });
  } catch (e) {
    if (e.message !== 'cancelled') notify('Capture failed', e.message);
  }
});

// --- Bridge from the web app (via content.js) --------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target === 'offscreen') return; // offscreen replies handled inline
  if (msg.type === 'ping') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return; // sync response
  }
  if (msg.type === 'capture') {
    capture()
      .then((shot) => sendResponse({ ok: true, ...shot }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // async response
  }
});

// --- Bridge from other extensions / allowlisted origins (externally_connectable)
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'ping') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return;
  }
  if (msg?.type === 'capture') {
    capture()
      .then((shot) => sendResponse({ ok: true, ...shot }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
