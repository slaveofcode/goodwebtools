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

/** Show the desktop picker and return a media stream id (or null if cancelled). */
function chooseDesktopMedia(sources = ['screen', 'window']) {
  return new Promise((resolve) => {
    chrome.desktopCapture.chooseDesktopMedia(sources, (streamId) => {
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
chrome.runtime.onInstalled.addListener(() => { void createMenus(); });

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

// --- Recording (tab via tabCapture, screen/window via desktopCapture) ---------
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
      streamId = await chooseDesktopMedia(['screen', 'window', 'tab', 'audio']);
      if (!streamId) return { ok: false, error: 'cancelled' };
    }
    const { recMic } = await chrome.storage.local.get('recMic');
    await ensureOffscreen();
    const res = await chrome.runtime.sendMessage({
      target: 'offscreen', type: 'rec-start', source: source === 'tab' ? 'tab' : 'desktop', streamId, mic: !!recMic,
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
