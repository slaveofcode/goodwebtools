// GoodWebTools Companion — service worker.
//
// Responsibilities:
//   1. Right-click menus: send an image, selected text, a link or the page URL to
//      the matching GoodWebTools tool. The data is handed over through content.js
//      (see lib/handoff-store.js) — nothing is uploaded anywhere.
//   2. Launcher popup support: open a tool, optionally with data.
//   3. Global hotkey (commands API) → capture the screen → open the region-select
//      overlay so the user can crop / download / copy, even while another app is
//      focused. This is the capability a web page cannot have.
//   4. Bridge for the web app: content.js relays "capture" and "handoff-get".
//
// The actual pixel grab needs a DOM (getUserMedia + canvas), which a service
// worker doesn't have — so we run it in an offscreen document.

import { MENU_ITEMS, PARENT_ID, DEFAULT_BASE, pickLang, toolUrl, findMenuItem } from './lib/menus.js';
import { createHandoffStore, bytesToBase64 } from './lib/handoff-store.js';
import { colorPickerOverlay, collectPageImages, pageMetrics, scrollForCapture, restoreAfterCapture } from './lib/inject.js';
import { capturePlan } from './lib/page-helpers.js';
import { saveShot } from './lib/recordings-db.js';

const handoffs = createHandoffStore(chrome.storage.session);
const MAX_HANDOFF_BYTES = 50 * 1024 * 1024;
/** Notification that leads to the popup page, where site access can be granted. */
const NEED_ACCESS = 'gwt-need-access';

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
    reasons: ['DISPLAY_MEDIA', 'USER_MEDIA', 'AUDIO_PLAYBACK'],
    justification: 'Grab a frame for a screenshot, and record the chosen tab or screen (playing the tab\'s sound back while it is captured).',
  });
}

/** The offscreen document shows Chrome's picker and grabs one frame as a PNG. */
async function grabFrame() {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({ target: 'offscreen', type: 'grab' });
}

/**
 * Full capture flow: pick source → grab frame.
 * Returns { dataUrl, width, height } or throws.
 */
async function capture() {
  const res = await grabFrame();
  if (!res || res.error) throw new Error(res?.error || 'grab-failed');
  return res;
}

function notify(title, message, id = '') {
  try {
    chrome.notifications.create(id, {
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
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'toggle-recording') {
    const res = (await recState()) ? await stopRecording() : await startRecording('tab', tab);
    if (!res.ok && res.error !== 'cancelled') notify(msg('notifyRecFailedTitle'), res.error);
    return;
  }
  if (command !== 'capture-screenshot') return;
  await captureToOverlay();
});

/**
 * Picker → capture → open the crop overlay. Runs entirely in the worker, so it
 * keeps going when the popup closes (Chrome's picker takes focus and closes it).
 */
async function captureToOverlay() {
  try {
    const shot = await capture();
    // Stash the capture for the overlay page (data URLs are too big for a query string).
    await chrome.storage.session.set({ pendingCapture: shot });
    await chrome.tabs.create({ url: chrome.runtime.getURL('select.html') });
  } catch (e) {
    if (e.message !== 'cancelled') notify('Capture failed', e.message);
  }
}

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

// --- Right-click menus --------------------------------------------------------
function msg(key) {
  return chrome.i18n.getMessage(key) || key;
}

async function createMenus() {
  await chrome.contextMenus.removeAll();
  const contexts = [...new Set(MENU_ITEMS.flatMap((m) => m.contexts))];
  for (const ctx of contexts) {
    chrome.contextMenus.create({ id: `${PARENT_ID}-${ctx}`, title: msg('menuParent'), contexts: [ctx] });
  }
  for (const item of MENU_ITEMS) {
    for (const ctx of item.contexts) {
      chrome.contextMenus.create({ id: item.id, parentId: `${PARENT_ID}-${ctx}`, title: msg(item.message), contexts: [ctx] });
    }
  }
}
chrome.runtime.onInstalled.addListener(() => { void createMenus(); void syncJsonTabs(); });
chrome.runtime.onStartup.addListener(() => { void syncJsonTabs(); });

/** Site base URL (overridable for local development) and language. */
async function siteSettings() {
  const { gwtBase, gwtLang } = await chrome.storage.local.get(['gwtBase', 'gwtLang']);
  return { base: gwtBase || DEFAULT_BASE, lang: pickLang(gwtLang, chrome.i18n.getUILanguage()) };
}

/** Open a tool, handing it a payload when given. */
async function openTool(toolId, payload, openerTab) {
  const { base, lang } = await siteSettings();
  const id = payload ? await handoffs.put(payload) : undefined;
  await chrome.tabs.create({
    url: toolUrl(base, toolId, lang, id),
    index: openerTab ? openerTab.index + 1 : undefined,
    openerTabId: openerTab?.id,
  });
}

/** Selected text, read in the page so line breaks survive (info.selectionText flattens them). */
async function readSelection(info, tab) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
      func: () => {
        const el = document.activeElement;
        if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && typeof el.selectionStart === 'number') {
          return el.value.slice(el.selectionStart, el.selectionEnd);
        }
        return String(window.getSelection() || '');
      },
    });
    if (res?.result) return res.result;
  } catch { /* restricted page — fall back */ }
  return info.selectionText || '';
}

function nameFromUrl(src, type) {
  let name = 'image';
  try { name = decodeURIComponent(new URL(src).pathname.split('/').pop() || 'image'); } catch { /* data: URL */ }
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    const ext = (type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
    name = `${name}.${ext}`;
  }
  return name.slice(0, 120);
}

async function blobToPayload(blob, src) {
  if (blob.size > MAX_HANDOFF_BYTES) throw new Error('too-big');
  const type = blob.type || 'image/png';
  return { kind: 'file', name: nameFromUrl(src, type), type, base64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())) };
}

/** Read the right-clicked image's bytes. */
async function readImage(info, tab, granted) {
  const src = info.srcUrl;
  if (src.startsWith('data:')) return blobToPayload(await (await fetch(src)).blob(), src);
  if (granted && !src.startsWith('blob:')) {
    try {
      const res = await fetch(src, { credentials: 'include' });
      if (res.ok) return blobToPayload(await res.blob(), src);
    } catch { /* fall back to reading it in the page */ }
  }
  // blob: URLs (and same-site images without the optional permission) are read in the page.
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
    func: async (url) => {
      const blob = await (await fetch(url)).blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { type: blob.type, base64: btoa(bin), size: blob.size };
    },
    args: [src],
  });
  const r = res?.result;
  if (!r) throw new Error('no-access');
  if (r.size > MAX_HANDOFF_BYTES) throw new Error('too-big');
  return { kind: 'file', name: nameFromUrl(src, r.type || 'image/png'), type: r.type || 'image/png', base64: r.base64 };
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const item = findMenuItem(info.menuItemId);
  if (!item) return;
  // Ask for site access first, synchronously inside the click's user gesture (no
  // await before this). It resolves at once without a prompt if already granted.
  const access = item.payload === 'image' && !info.srcUrl?.startsWith('data:')
    ? chrome.permissions.request({ origins: ['<all_urls>'] }).catch(() => false)
    : Promise.resolve(true);
  void (async () => {
    try {
      let payload;
      if (item.payload === 'image') payload = await readImage(info, tab, await access);
      else if (item.payload === 'selection') payload = { kind: 'text', text: await readSelection(info, tab) };
      else if (item.payload === 'link') payload = { kind: 'text', text: info.linkUrl || '' };
      else payload = { kind: 'text', text: info.pageUrl || tab?.url || '' };
      await openTool(item.tool, payload, tab);
    } catch (e) {
      if (e.message === 'too-big') notify(msg('notifyFailedTitle'), msg('notifyTooBig'));
      else if (item.payload === 'image') notify(msg('notifyNoAccessTitle'), msg('notifyNoAccess'), NEED_ACCESS);
      else notify(msg('notifyFailedTitle'), String(e.message || e));
    }
  })();
});

// --- Handoff + launcher messages (content.js / popup) --------------------------
chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
  if (m?.target === 'offscreen') return; // meant for the offscreen document
  if (m?.type === 'handoff-get') {
    handoffs.take(m.handoffId).then((payload) => sendResponse({ ok: !!payload, payload }));
    return true;
  }
  if (m?.type === 'rec-start') {
    // A screen recording needs no tab; tabs.get(undefined) would throw synchronously.
    const tab = Number.isInteger(m.tabId) ? chrome.tabs.get(m.tabId).catch(() => null) : Promise.resolve(null);
    tab.then((t) => startRecording(m.source, t)).then(sendResponse);
    return true;
  }
  if (m?.type === 'rec-stop' || m?.type === 'rec-ended') {
    stopRecording().then(sendResponse);
    return true;
  }
  if (m?.type === 'page-color' || m?.type === 'page-images' || m?.type === 'page-shot') {
    const run = { 'page-color': pickColor, 'page-images': saveImages, 'page-shot': fullPageShot }[m.type];
    chrome.tabs.get(m.tabId).then(run).then((r) => sendResponse({ ok: true, ...r }), (e) => {
      // The popup has already closed, so say what went wrong in a notification.
      notify(msg('notifyPageFailedTitle'), e.message || String(e));
      sendResponse({ ok: false, error: e.message || String(e) });
    });
    return true;
  }
  if (m?.type === 'capture-open') {
    void captureToOverlay();
    sendResponse({ ok: true });
    return;
  }
  if (m?.type === 'json-tabs') {
    syncJsonTabs(m.enabled).then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (m?.type === 'rec-state') {
    recState().then((state) => sendResponse({ ok: true, state }));
    return true;
  }
  if (m?.type === 'open-tool') {
    openTool(m.tool, m.payload).then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

// "Can't read that image" → open the launcher page, which has the allow button.
chrome.notifications.onClicked.addListener((id) => {
  if (id === NEED_ACCESS) chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
});

// --- Recording (tab via tabCapture, screen/window via the offscreen picker) ---
const REC_KEY = 'rec';

async function recState() {
  return (await chrome.storage.session.get(REC_KEY))[REC_KEY] || null;
}

function setBadge(on) {
  chrome.action.setBadgeText({ text: on ? 'REC' : '' });
  if (on) chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
}

/** Start recording "tab" (the given tab, no picker) or "screen" (screen/window picker). */
async function startRecording(source, tab) {
  if (await recState()) return { ok: false, error: 'already-recording' };
  try {
    let streamId;
    if (source === 'tab') {
      if (!tab?.id) return { ok: false, error: 'no-tab' };
      streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    } else {
      streamId = null; // the offscreen document shows Chrome's picker (getDisplayMedia)
    }
    const { recMic } = await chrome.storage.local.get('recMic');
    await ensureOffscreen();
    const res = await chrome.runtime.sendMessage({
      target: 'offscreen', type: 'rec-start', source: source === 'tab' ? 'tab' : 'display', streamId, mic: !!recMic,
    });
    if (!res?.ok) return { ok: false, error: res?.error || 'record-failed' };
    await chrome.storage.session.set({ [REC_KEY]: { source, startedAt: res.startedAt, title: tab?.title || '' } });
    setBadge(true);
    return { ok: true, startedAt: res.startedAt };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/** Stop, save (offscreen → IndexedDB) and open the result page. */
async function stopRecording() {
  if (!(await recState())) return { ok: false, error: 'not-recording' };
  await chrome.storage.session.remove(REC_KEY);
  setBadge(false);
  const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'rec-stop' }).catch((e) => ({ error: e.message }));
  if (!res?.ok) return { ok: false, error: res?.error || 'stop-failed' };
  await chrome.tabs.create({ url: chrome.runtime.getURL('recording.html') });
  return { ok: true, ...res };
}

// A restarted worker shouldn't show a stale badge.
recState().then((state) => setBadge(!!state));

// --- Page helpers (run on the current tab, with the popup's activeTab grant) --
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function inTab(tab, func, args = []) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args });
  return res?.result;
}

/** Color picker panel in the page (EyeDropper needs a click inside the page). */
async function pickColor(tab) {
  const t = {};
  for (const k of ['title', 'hint', 'pick', 'copy', 'copied', 'close', 'unsupported']) t[k] = msg(`color_${k}`);
  await inTab(tab, colorPickerOverlay, [t]);
  return {};
}

/** Collect the page's images, then show them on images.html to pick and download. */
async function saveImages(tab) {
  const found = await inTab(tab, collectPageImages);
  await chrome.storage.session.set({ pageImages: { ...found, at: Date.now() } });
  await chrome.tabs.create({ url: chrome.runtime.getURL('images.html'), index: tab.index + 1, openerTabId: tab.id });
  return { count: found?.images?.length || 0 };
}

/**
 * Full-page screenshot: scroll the page a viewport at a time, capture each view
 * (Chrome allows ~2 captures a second), stitch them in an OffscreenCanvas.
 */
async function fullPageShot(tab) {
  // captureVisibleTab grabs whichever tab is active, so make sure it's this one.
  await chrome.tabs.update(tab.id, { active: true });
  const m = await inTab(tab, pageMetrics);
  // Keep the stitched image inside canvas limits (~30k device pixels tall).
  const plan = capturePlan(m.scrollHeight, m.innerHeight, Math.floor(30000 / m.dpr));
  let canvas = null;
  let ctx = null;
  try {
    for (let i = 0; i < plan.ys.length; i++) {
      const y = await inTab(tab, scrollForCapture, [plan.ys[i], i > 0]);
      await sleep(i ? 550 : 150); // let the page settle; respect the capture rate limit
      const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
      if (active?.id !== tab.id) throw new Error(msg('shotTabChanged'));
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
      const scale = bmp.width / m.innerWidth;
      if (!canvas) {
        canvas = new OffscreenCanvas(bmp.width, Math.round(plan.height * scale));
        ctx = canvas.getContext('2d');
      }
      ctx.drawImage(bmp, 0, Math.round(y * scale));
      bmp.close();
    }
  } finally {
    await inTab(tab, restoreAfterCapture, [m.x, m.y]).catch(() => {});
  }
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  await saveShot({ blob, width: canvas.width, height: canvas.height, truncated: plan.truncated, title: tab.title || '', at: Date.now() });
  await chrome.tabs.create({ url: chrome.runtime.getURL('shot.html'), index: tab.index + 1, openerTabId: tab.id });
  return { width: canvas.width, height: canvas.height };
}

// --- JSON tabs: offer the JSON Viewer on pages that are JSON ------------------
const JSON_SCRIPT = 'gwt-json-tabs';

/** Register the JSON detector when the setting is on and site access is granted. */
async function syncJsonTabs(enabled) {
  if (typeof enabled === 'boolean') await chrome.storage.local.set({ jsonTabs: enabled });
  const { jsonTabs } = await chrome.storage.local.get('jsonTabs');
  const allowed = await chrome.permissions.contains({ origins: ['<all_urls>'] });
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [JSON_SCRIPT] });
  const want = !!jsonTabs && allowed;
  if (want && !existing.length) {
    await chrome.scripting.registerContentScripts([{ id: JSON_SCRIPT, matches: ['<all_urls>'], js: ['inject/json-detect.js'], runAt: 'document_idle' }]);
  } else if (!want && existing.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [JSON_SCRIPT] });
  }
}
chrome.permissions.onRemoved.addListener(() => { void syncJsonTabs(); });
