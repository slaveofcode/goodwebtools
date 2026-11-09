// Right-click menu definitions for the Companion. Pure data + helpers, so they
// can be unit-tested outside Chrome.

/** Where each menu item sends the user, and what it hands over. */
export const MENU_ITEMS = [
  // On an image
  { id: 'img-compress', contexts: ['image'], message: 'menuImgCompress', tool: 'image-compress', payload: 'image' },
  { id: 'img-convert', contexts: ['image'], message: 'menuImgConvert', tool: 'image-convert', payload: 'image' },
  { id: 'img-resize', contexts: ['image'], message: 'menuImgResize', tool: 'image-resize', payload: 'image' },
  { id: 'img-crop', contexts: ['image'], message: 'menuImgCrop', tool: 'image-crop', payload: 'image' },
  { id: 'img-bg', contexts: ['image'], message: 'menuImgBg', tool: 'image-bg-remove', payload: 'image' },
  { id: 'img-annotate', contexts: ['image'], message: 'menuImgAnnotate', tool: 'image-annotate', payload: 'image' },
  { id: 'img-watermark', contexts: ['image'], message: 'menuImgWatermark', tool: 'image-watermark', payload: 'image' },
  { id: 'img-palette', contexts: ['image'], message: 'menuImgPalette', tool: 'image-palette', payload: 'image' },
  { id: 'img-ocr', contexts: ['image'], message: 'menuImgOcr', tool: 'image-ocr', payload: 'image' },
  { id: 'img-qr', contexts: ['image'], message: 'menuImgQr', tool: 'qr-read', payload: 'image' },
  { id: 'img-upscale', contexts: ['image'], message: 'menuImgUpscale', tool: 'image-upscale', payload: 'image' },
  { id: 'img-pdf', contexts: ['image'], message: 'menuImgPdf', tool: 'images-to-pdf', payload: 'image' },
  // On selected text
  { id: 'sel-count', contexts: ['selection'], message: 'menuSelCount', tool: 'word-counter', payload: 'selection' },
  { id: 'sel-speak', contexts: ['selection'], message: 'menuSelSpeak', tool: 'text-to-speech', payload: 'selection' },
  { id: 'sel-case', contexts: ['selection'], message: 'menuSelCase', tool: 'case-converter', payload: 'selection' },
  { id: 'sel-qr', contexts: ['selection'], message: 'menuSelQr', tool: 'qr-gen', payload: 'selection' },
  { id: 'sel-compare', contexts: ['selection'], message: 'menuSelCompare', tool: 'text-diff', payload: 'compare' },
  // On selected text → Developer
  { id: 'sel-json', contexts: ['selection'], group: 'dev', message: 'menuSelJson', tool: 'json-format', payload: 'selection' },
  { id: 'sel-json-tree', contexts: ['selection'], group: 'dev', message: 'menuSelJsonTree', tool: 'json-viewer', payload: 'selection' },
  { id: 'sel-base64', contexts: ['selection'], group: 'dev', message: 'menuSelBase64', tool: 'base64', payload: 'selection' },
  { id: 'sel-hash', contexts: ['selection'], group: 'dev', message: 'menuSelHash', tool: 'hash-text', payload: 'selection' },
  { id: 'sel-jwt', contexts: ['selection'], group: 'dev', message: 'menuSelJwt', tool: 'jwt-decode', payload: 'selection' },
  { id: 'sel-url', contexts: ['selection'], group: 'dev', message: 'menuSelUrl', tool: 'url-encode', payload: 'selection' },
  { id: 'sel-time', contexts: ['selection'], group: 'dev', message: 'menuSelTime', tool: 'timestamp', payload: 'selection' },
  { id: 'sel-sql', contexts: ['selection'], group: 'dev', message: 'menuSelSql', tool: 'sql-format', payload: 'selection' },
  { id: 'sel-regex', contexts: ['selection'], group: 'dev', message: 'menuSelRegex', tool: 'regex-tester', payload: 'selection', field: 1 },
  { id: 'sel-md', contexts: ['selection'], group: 'dev', message: 'menuSelMd', tool: 'markdown', payload: 'selection' },
  // In a text field
  { id: 'edit-password', contexts: ['editable'], message: 'menuEditPassword', payload: 'password' },
  // On a link, or anywhere on the page
  { id: 'link-qr', contexts: ['link'], message: 'menuLinkQr', tool: 'qr-gen', payload: 'link' },
  { id: 'page-qr', contexts: ['page'], message: 'menuPageQr', tool: 'qr-gen', payload: 'page' },
  { id: 'page-read', contexts: ['page'], message: 'menuPageRead', tool: 'text-to-speech', payload: 'page-text' },
  { id: 'page-count', contexts: ['page'], message: 'menuPageCount', tool: 'word-counter', payload: 'page-text' },
  { id: 'page-links', contexts: ['page'], message: 'menuPageLinks', payload: 'page-links' },
  { id: 'page-palette', contexts: ['page'], message: 'menuPagePalette', tool: 'image-palette', payload: 'page-shot' },
];

/** Submenus inside the GoodWebTools menu: group id → message key. */
export const MENU_GROUPS = { dev: 'menuGroupDev' };

/** Parent menu id per context ("GoodWebTools ▸ …"). */
export const PARENT_ID = 'gwt';

export const DEFAULT_BASE = 'https://goodwebtools.com';

/** Pick the site language: a saved choice wins, else the browser's UI language. */
export function pickLang(saved, uiLanguage) {
  if (saved === 'en' || saved === 'id') return saved;
  return /^(id|in)\b/i.test(uiLanguage || '') ? 'id' : 'en';
}

/** URL of a tool page, optionally carrying a single-use handoff id. */
export function toolUrl(base, toolId, lang, handoffId) {
  const root = (base || DEFAULT_BASE).replace(/\/+$/, '');
  const prefix = lang === 'id' ? '/id' : '';
  return `${root}${prefix}/tools/${toolId}/${handoffId ? `#gwt-handoff=${handoffId}` : ''}`;
}

export function findMenuItem(id) {
  return MENU_ITEMS.find(m => m.id === id) || null;
}

/** Tools pinned in the side panel until the user changes them. */
export const DEFAULT_PANEL_TOOLS = ['music-player', 'pomodoro-timer', 'todo', 'notepad', 'json-viewer', 'unit-converter', 'scientific-calculator', 'qr-gen'];

/** Suggested in the side panel's browse list: quick utilities that are useful next to a page. */
export const HANDY_PANEL_TOOLS = ['unit-converter', 'percentage-calculator', 'color-convert', 'password-gen', 'uuid-gen', 'timestamp', 'case-converter', 'word-counter', 'text-diff', 'json-format', 'base64', 'qr-gen'];

/** One-click productivity tools in the popup; they open in the side panel and keep running while you browse. */
export const PRODUCTIVITY_TOOLS = ['pomodoro-timer', 'todo', 'notepad', 'timer-stopwatch', 'scientific-calculator', 'timezone-converter'];

/** Tool page URL in embed mode (just the tool, no site header/footer) for the side panel. */
export function embedUrl(base, toolId, lang) {
  return `${toolUrl(base, toolId, lang)}?embed=1`;
}
