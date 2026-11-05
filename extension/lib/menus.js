// Right-click menu definitions for the Companion. Pure data + helpers, so they
// can be unit-tested outside Chrome.

/** Where each menu item sends the user, and what it hands over. */
export const MENU_ITEMS = [
  // On an image
  { id: 'img-compress', contexts: ['image'], message: 'menuImgCompress', tool: 'image-compress', payload: 'image' },
  { id: 'img-convert', contexts: ['image'], message: 'menuImgConvert', tool: 'image-convert', payload: 'image' },
  { id: 'img-resize', contexts: ['image'], message: 'menuImgResize', tool: 'image-resize', payload: 'image' },
  { id: 'img-bg', contexts: ['image'], message: 'menuImgBg', tool: 'image-bg-remove', payload: 'image' },
  { id: 'img-ocr', contexts: ['image'], message: 'menuImgOcr', tool: 'image-ocr', payload: 'image' },
  { id: 'img-qr', contexts: ['image'], message: 'menuImgQr', tool: 'qr-read', payload: 'image' },
  { id: 'img-upscale', contexts: ['image'], message: 'menuImgUpscale', tool: 'image-upscale', payload: 'image' },
  // On selected text
  { id: 'sel-json', contexts: ['selection'], message: 'menuSelJson', tool: 'json-format', payload: 'selection' },
  { id: 'sel-json-tree', contexts: ['selection'], message: 'menuSelJsonTree', tool: 'json-viewer', payload: 'selection' },
  { id: 'sel-base64', contexts: ['selection'], message: 'menuSelBase64', tool: 'base64', payload: 'selection' },
  { id: 'sel-hash', contexts: ['selection'], message: 'menuSelHash', tool: 'hash-text', payload: 'selection' },
  { id: 'sel-count', contexts: ['selection'], message: 'menuSelCount', tool: 'word-counter', payload: 'selection' },
  { id: 'sel-speak', contexts: ['selection'], message: 'menuSelSpeak', tool: 'text-to-speech', payload: 'selection' },
  { id: 'sel-qr', contexts: ['selection'], message: 'menuSelQr', tool: 'qr-gen', payload: 'selection' },
  // On a link, or anywhere on the page
  { id: 'link-qr', contexts: ['link'], message: 'menuLinkQr', tool: 'qr-gen', payload: 'link' },
  { id: 'page-qr', contexts: ['page'], message: 'menuPageQr', tool: 'qr-gen', payload: 'page' },
];

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
