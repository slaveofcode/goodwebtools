// Side panel: a GoodWebTools tool next to whatever page you're on. The panel
// stays open while you switch tabs, so the Music Player keeps playing as you browse.
import { DEFAULT_BASE, DEFAULT_PANEL_TOOLS, pickLang, embedUrl, toolUrl } from './lib/menus.js';
import { searchTools, toggleFavorite } from './lib/search.js';

const T = {
  en: { pin: 'Pin to this list', unpin: 'Unpin from this list', find: 'Find a tool', popout: 'Open in a tab', search: 'Search tools…' },
  id: { pin: 'Sematkan ke daftar', unpin: 'Lepas dari daftar', find: 'Cari tool', popout: 'Buka di tab', search: 'Cari tool…' },
};
const $ = (id) => document.getElementById(id);
const state = { tools: [], base: DEFAULT_BASE, lang: 'en', pinned: DEFAULT_PANEL_TOOLS, current: DEFAULT_PANEL_TOOLS[0], sel: 0, shown: [] };

const label = (t) => (state.lang === 'id' ? t.nameId || t.name : t.name);
const byId = (id) => state.tools.find((t) => t.id === id);

async function loadTools() {
  const { toolsIndex } = await chrome.storage.local.get('toolsIndex');
  if (toolsIndex?.tools?.length) return toolsIndex.tools;
  return (await fetch(chrome.runtime.getURL('data/tools-index.json'))).json();
}

function renderHeader() {
  const t = T[state.lang];
  const ids = state.pinned.includes(state.current) ? state.pinned : [...state.pinned, state.current];
  $('tool').replaceChildren(...ids.filter(byId).map((id) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = label(byId(id));
    o.selected = id === state.current;
    return o;
  }));
  const pinned = state.pinned.includes(state.current);
  $('pin').textContent = pinned ? '★' : '☆';
  $('pin').setAttribute('aria-pressed', String(pinned));
  $('pin').title = pinned ? t.unpin : t.pin;
  $('find').textContent = '⌕';
  $('find').title = t.find;
  $('popout').textContent = '↗';
  $('popout').title = t.popout;
  $('q').placeholder = t.search;
  for (const b of ['pin', 'find', 'popout']) $(b).setAttribute('aria-label', $(b).title);
}

/** Show a tool in the frame (only reloads when it actually changes). */
function show(id) {
  state.current = id;
  const url = embedUrl(state.base, id, state.lang);
  if ($('frame').src !== url) $('frame').src = url;
  chrome.storage.local.set({ panelTool: id });
  renderHeader();
}

function renderResults() {
  const q = $('q').value;
  state.shown = q.trim() ? searchTools(state.tools, q, 10) : state.pinned.map(byId).filter(Boolean);
  state.sel = Math.min(state.sel, Math.max(0, state.shown.length - 1));
  $('results').replaceChildren(...state.shown.map((t, i) => {
    const li = document.createElement('li');
    li.role = 'option';
    if (i === state.sel) li.setAttribute('aria-selected', 'true');
    li.textContent = label(t);
    const sum = document.createElement('span');
    sum.className = 'sum';
    sum.textContent = state.lang === 'id' ? t.summaryId || t.summary : t.summary;
    li.append(sum);
    li.addEventListener('click', () => pick(t.id));
    return li;
  }));
}

function toggleSearch(open = $('search').hidden) {
  $('search').hidden = !open;
  $('find').setAttribute('aria-expanded', String(open));
  if (open) { $('q').value = ''; state.sel = 0; renderResults(); $('q').focus(); }
}

function pick(id) {
  toggleSearch(false);
  show(id);
}

async function init() {
  const saved = await chrome.storage.local.get(['gwtBase', 'gwtLang', 'panelTools', 'panelTool']);
  state.base = saved.gwtBase || DEFAULT_BASE;
  state.lang = pickLang(saved.gwtLang, chrome.i18n.getUILanguage());
  state.pinned = saved.panelTools?.length ? saved.panelTools : DEFAULT_PANEL_TOOLS;
  state.tools = await loadTools();
  show(saved.panelTool && byId(saved.panelTool) ? saved.panelTool : state.pinned[0]);

  $('tool').addEventListener('change', (e) => show(e.target.value));
  $('pin').addEventListener('click', async () => {
    state.pinned = toggleFavorite(state.pinned, state.current);
    await chrome.storage.local.set({ panelTools: state.pinned });
    renderHeader();
  });
  $('find').addEventListener('click', () => toggleSearch());
  $('popout').addEventListener('click', () => chrome.tabs.create({ url: toolUrl(state.base, state.current, state.lang) }));
  $('q').addEventListener('input', () => { state.sel = 0; renderResults(); });
  $('q').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { state.sel = Math.min(state.sel + 1, state.shown.length - 1); renderResults(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { state.sel = Math.max(state.sel - 1, 0); renderResults(); e.preventDefault(); }
    else if (e.key === 'Enter' && state.shown[state.sel]) pick(state.shown[state.sel].id);
    else if (e.key === 'Escape') toggleSearch(false);
  });
  // The launcher can ask the panel to switch tools.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.panelTool?.newValue && changes.panelTool.newValue !== state.current) show(changes.panelTool.newValue);
    if (area === 'local' && changes.gwtLang?.newValue) { state.lang = changes.gwtLang.newValue; $('frame').src = embedUrl(state.base, state.current, state.lang); renderHeader(); }
  });
}

void init();
