// Launcher popup: search every GoodWebTools tool, keep favorites and recents,
// and run quick actions on the current page.
import { DEFAULT_BASE, pickLang, toolUrl } from './lib/menus.js';
import { searchTools, pushRecent, toggleFavorite } from './lib/search.js';
import { formatDuration } from './lib/recording.js';

const T = {
  en: {
    search: 'Search 200+ tools…', favorites: 'Favorites', recent: 'Recent', quick: 'Quick actions', none: 'No tools match.',
    qrPage: 'QR code of this page', capture: 'Capture screen', hotkey: 'Screenshot:', recKey: 'Record:', unset: 'not set', shortcuts: 'set hotkeys',
    star: 'Add to favorites', unstar: 'Remove from favorites', panel: 'Open side panel', inPanel: 'Open in the side panel',
    page: 'This page', pgColor: 'Pick a color', pgImages: 'Save images & media', pgShot: 'Full-page screenshot', jsonTabs: 'Open data files (JSON, YAML, TOML, Markdown) in GoodWebTools', dataAuto: 'Open them automatically',
    rec: 'Record', recTab: 'Record this tab', recScreen: 'Record screen…', recMic: 'Include my microphone', recStop: (t) => `■ Stop recording · ${t}`,
    access: 'Allow the Companion to read images on websites so right-click image actions work everywhere.', grant: 'Allow images from websites',
  },
  id: {
    search: 'Cari 200+ tool…', favorites: 'Favorit', recent: 'Terakhir', quick: 'Aksi cepat', none: 'Tidak ada tool yang cocok.',
    qrPage: 'Kode QR halaman ini', capture: 'Tangkap layar', hotkey: 'Tangkap layar:', recKey: 'Rekam:', unset: 'belum diatur', shortcuts: 'atur pintasan',
    star: 'Tambah ke favorit', unstar: 'Hapus dari favorit', panel: 'Buka panel samping', inPanel: 'Buka di panel samping',
    page: 'Halaman ini', pgColor: 'Ambil warna', pgImages: 'Simpan gambar & media', pgShot: 'Tangkapan layar penuh', jsonTabs: 'Buka berkas data (JSON, YAML, TOML, Markdown) di GoodWebTools', dataAuto: 'Buka otomatis',
    rec: 'Rekam', recTab: 'Rekam tab ini', recScreen: 'Rekam layar…', recMic: 'Sertakan mikrofon saya', recStop: (t) => `■ Hentikan rekaman · ${t}`,
    access: 'Izinkan Companion membaca gambar di situs web agar aksi klik kanan pada gambar berfungsi di mana saja.', grant: 'Izinkan gambar dari situs web',
  },
};

const $ = (id) => document.getElementById(id);
let state = { tools: [], lang: 'en', base: DEFAULT_BASE, favs: [], recents: [], sel: 0, shown: [], windowId: undefined };

/** Open the side panel, optionally switching it to a tool. Must run inside the click (user gesture). */
function openPanel(toolId) {
  if (toolId) chrome.storage.local.set({ panelTool: toolId });
  chrome.sidePanel.open({ windowId: state.windowId }).then(() => window.close()).catch(() => { /* no side panel support */ });
}

/** Bundled snapshot, then the cached copy, refreshed from the site in the background. */
async function loadTools() {
  const { toolsIndex } = await chrome.storage.local.get('toolsIndex');
  let tools = toolsIndex?.tools;
  if (!tools?.length) tools = await (await fetch(chrome.runtime.getURL('data/tools-index.json'))).json();
  const fresh = !toolsIndex || Date.now() - toolsIndex.at > 24 * 3600 * 1000;
  if (fresh) {
    fetch(`${state.base}/tools-index.json`).then((r) => (r.ok ? r.json() : null)).then((list) => {
      if (Array.isArray(list) && list.length) {
        chrome.storage.local.set({ toolsIndex: { at: Date.now(), tools: list } });
        state.tools = list;
        render();
      }
    }).catch(() => { /* offline — keep what we have */ });
  }
  return tools;
}

const label = (t) => (state.lang === 'id' ? { name: t.nameId || t.name, summary: t.summaryId || t.summary } : { name: t.name, summary: t.summary });

function row(t, i, listId) {
  const li = document.createElement('li');
  li.role = 'option';
  li.dataset.id = t.id;
  if (listId === 'results' && i === state.sel) li.setAttribute('aria-selected', 'true');
  const { name, summary } = label(t);
  const txt = document.createElement('span');
  txt.className = 'txt';
  txt.innerHTML = '<span class="name"></span><span class="sum"></span>';
  txt.firstChild.textContent = name;
  txt.lastChild.textContent = summary;
  const star = document.createElement('button');
  const fav = state.favs.includes(t.id);
  star.className = 'star';
  star.textContent = fav ? '★' : '☆';
  star.setAttribute('aria-pressed', String(fav));
  star.title = T[state.lang][fav ? 'unstar' : 'star'];
  star.setAttribute('aria-label', star.title);
  star.addEventListener('click', async (e) => {
    e.stopPropagation();
    state.favs = toggleFavorite(state.favs, t.id);
    await chrome.storage.local.set({ favs: state.favs });
    render();
  });
  const side = document.createElement('button');
  side.className = 'side';
  side.textContent = '◧';
  side.title = T[state.lang].inPanel;
  side.setAttribute('aria-label', side.title);
  side.addEventListener('click', (e) => { e.stopPropagation(); openPanel(t.id); });
  li.append(txt, side, star);
  li.addEventListener('click', () => open(t.id));
  return li;
}

function fill(listId, tools) {
  const ul = $(listId);
  ul.replaceChildren(...tools.map((t, i) => row(t, i, listId)));
}

function render() {
  const t = T[state.lang];
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
  $('q').placeholder = t.search;
  const query = $('q').value;
  const byId = new Map(state.tools.map((x) => [x.id, x]));
  if (query.trim()) {
    state.shown = searchTools(state.tools, query);
    state.sel = Math.min(state.sel, Math.max(0, state.shown.length - 1));
    $('home').hidden = true;
    fill('results', state.shown);
    if (!state.shown.length) $('results').innerHTML = `<li class="empty">${t.none}</li>`;
    return;
  }
  $('results').replaceChildren();
  $('home').hidden = false;
  $('favTitle').textContent = state.favs.length ? t.favorites : '';
  $('recentTitle').textContent = state.recents.length ? t.recent : '';
  fill('favs', state.favs.map((id) => byId.get(id)).filter(Boolean));
  fill('recents', state.recents.filter((id) => !state.favs.includes(id)).map((id) => byId.get(id)).filter(Boolean).slice(0, 5));
  $('quickTitle').textContent = t.quick;
  $('qrPage').textContent = t.qrPage;
  $('capture').textContent = t.capture;
  $('panel').textContent = t.panel;
  $('pageTitle').textContent = t.page;
  $('pgColor').textContent = t.pgColor;
  $('pgImages').textContent = t.pgImages;
  $('pgShot').textContent = t.pgShot;
  $('jsonTabsLabel').textContent = t.jsonTabs;
  $('dataAutoLabel').textContent = t.dataAuto;
  $('recTitle').textContent = t.rec;
  $('recTab').textContent = t.recTab;
  $('recScreen').textContent = t.recScreen;
  $('recMicLabel').textContent = t.recMic;
  renderRec();
  $('hotkeyLabel').textContent = t.hotkey;
  $('recKeyLabel').textContent = t.recKey;
  renderHotkeys();
  $('shortcuts').textContent = t.shortcuts;
  $('accessText').textContent = t.access;
  $('grant').textContent = t.grant;
}

/** Current shortcuts; Chrome leaves one unset when its suggested key clashes or on updates. */
function renderHotkeys() {
  const key = (name) => (state.commands || []).find((c) => c.name === name)?.shortcut || T[state.lang].unset;
  $('hotkey').textContent = key('capture-screenshot');
  $('recKey').textContent = key('toggle-recording');
}

/** Recording controls: start buttons, or Stop with a running timer. */
let recTimer = null;
function renderRec() {
  const on = !!state.rec;
  $('recIdle').hidden = on;
  $('recOn').hidden = !on;
  clearInterval(recTimer);
  if (!on) return;
  const tick = () => { $('recStop').textContent = T[state.lang].recStop(formatDuration(Date.now() - state.rec.startedAt)); };
  tick();
  recTimer = setInterval(tick, 1000);
}

async function startRec(source) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const res = await chrome.runtime.sendMessage({ type: 'rec-start', source, tabId: tab?.id });
  if (res?.ok) window.close();
}

async function open(id) {
  state.recents = pushRecent(state.recents, id);
  await chrome.storage.local.set({ recents: state.recents });
  await chrome.tabs.create({ url: toolUrl(state.base, id, state.lang) });
  window.close();
}

async function init() {
  // The window id is needed synchronously when opening the side panel (it must stay inside the click).
  chrome.windows.getCurrent().then((w) => { state.windowId = w.id; });
  const saved = await chrome.storage.local.get(['gwtBase', 'gwtLang', 'favs', 'recents', 'recMic', 'jsonTabs', 'dataAuto']);
  $('jsonTabs').checked = !!saved.jsonTabs;
  $('dataAuto').checked = !!saved.dataAuto;
  $('dataAutoRow').hidden = !saved.jsonTabs;
  state.rec = (await chrome.runtime.sendMessage({ type: 'rec-state' }).catch(() => null))?.state || null;
  $('recMic').checked = !!saved.recMic;
  state.base = saved.gwtBase || DEFAULT_BASE;
  state.lang = pickLang(saved.gwtLang, chrome.i18n.getUILanguage());
  state.favs = saved.favs || [];
  state.recents = saved.recents || [];
  state.tools = await loadTools();
  render();
  $('q').focus();

  $('q').addEventListener('input', () => { state.sel = 0; render(); });
  $('q').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { state.sel = Math.min(state.sel + 1, state.shown.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { state.sel = Math.max(state.sel - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && state.shown[state.sel]) open(state.shown[state.sel].id);
  });
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', async () => {
    state.lang = b.dataset.lang;
    await chrome.storage.local.set({ gwtLang: state.lang });
    render();
  }));

  $('qrPage').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({ type: 'open-tool', tool: 'qr-gen', payload: { kind: 'text', text: tab?.url || '' } });
    window.close();
  });
  $('panel').addEventListener('click', () => openPanel());
  // Page helpers work on the current tab (the popup's activeTab grant); the popup
  // closes at once so it isn't in the way of the picker or the screenshot.
  for (const [btn, type] of [['pgColor', 'page-color'], ['pgImages', 'page-images'], ['pgShot', 'page-shot']]) {
    $(btn).addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.runtime.sendMessage({ type, tabId: tab?.id });
      setTimeout(() => window.close(), 50);
    });
  }
  $('jsonTabs').addEventListener('change', async (e) => {
    const on = e.target.checked;
    // Detecting JSON pages needs site access; ask inside this click.
    if (on && !(await chrome.permissions.request({ origins: ['<all_urls>'] }).catch(() => false))) { e.target.checked = false; return; }
    await chrome.runtime.sendMessage({ type: 'json-tabs', enabled: on });
    $('dataAutoRow').hidden = !on;
  });
  $('dataAuto').addEventListener('change', (e) => chrome.storage.local.set({ dataAuto: e.target.checked }));
  $('recTab').addEventListener('click', () => startRec('tab'));
  $('recScreen').addEventListener('click', () => startRec('screen'));
  $('recStop').addEventListener('click', async () => { await chrome.runtime.sendMessage({ type: 'rec-stop' }); window.close(); });
  $('recMic').addEventListener('change', async (e) => {
    const on = e.target.checked;
    await chrome.storage.local.set({ recMic: on });
    // Offscreen documents can't ask for the microphone, so ask once from a normal page.
    if (on) {
      const perm = await navigator.permissions.query({ name: 'microphone' }).catch(() => null);
      if (perm?.state !== 'granted') chrome.tabs.create({ url: chrome.runtime.getURL('mic.html') });
    }
  });
  // The screen picker closes this popup, so the worker runs the whole capture
  // (picker → frame → crop page); the popup just hands it over.
  $('capture').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'capture-open' });
    setTimeout(() => window.close(), 50);
  });
  chrome.commands.getAll((cmds) => { state.commands = cmds; renderHotkeys(); });
  $('shortcuts').addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); });

  const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] });
  $('access').hidden = granted;
  $('grant').addEventListener('click', async () => {
    if (await chrome.permissions.request({ origins: ['<all_urls>'] })) $('access').hidden = true;
  });
}

void init();
