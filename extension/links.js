// Every link on the page the user was on: filter, copy the URLs, or download a CSV.
import { pickLang } from './lib/menus.js';
import { linksToCsv } from './lib/page-helpers.js';

const T = {
  en: { title: 'Links on this page', from: (n, u) => `${n} links from ${u}`, filter: 'Filter by text or URL…', external: 'Other sites only', copy: (n) => `Copy ${n} URLs`, csv: 'Download CSV', copied: 'Copied.', hText: 'Text', hUrl: 'URL', empty: 'No links found on this page.' },
  id: { title: 'Tautan di halaman ini', from: (n, u) => `${n} tautan dari ${u}`, filter: 'Saring menurut teks atau URL…', external: 'Hanya situs lain', copy: (n) => `Salin ${n} URL`, csv: 'Unduh CSV', copied: 'Tersalin.', hText: 'Teks', hUrl: 'URL', empty: 'Tidak ada tautan di halaman ini.' },
};
const $ = (id) => document.getElementById(id);
const { gwtLang } = await chrome.storage.local.get('gwtLang');
const t = T[pickLang(gwtLang, chrome.i18n.getUILanguage())];
const { pageLinks } = await chrome.storage.session.get('pageLinks');
const links = pageLinks?.links || [];
let host = '';
try { host = new URL(pageLinks?.url).hostname; } catch { /* none */ }

$('title').textContent = t.title;
$('from').textContent = links.length ? t.from(links.length, host) : t.empty;
$('filter').placeholder = t.filter;
$('externalLabel').textContent = t.external;
$('csv').textContent = t.csv;
$('hText').textContent = t.hText;
$('hUrl').textContent = t.hUrl;

const shown = () => {
  const q = $('filter').value.trim().toLowerCase();
  return links.filter((l) => {
    if ($('external').checked) { try { if (new URL(l.href).hostname === host) return false; } catch { return false; } }
    return !q || l.href.toLowerCase().includes(q) || (l.text || '').toLowerCase().includes(q);
  });
};

function render() {
  const list = shown();
  $('copy').textContent = t.copy(list.length);
  $('copy').disabled = $('csv').disabled = !list.length;
  $('rows').replaceChildren(...list.map((l) => {
    const tr = document.createElement('tr');
    const text = document.createElement('td');
    text.textContent = l.text;
    const url = document.createElement('td');
    url.className = 'url';
    const a = Object.assign(document.createElement('a'), { href: l.href, textContent: l.href, target: '_blank', rel: 'noopener noreferrer' });
    url.append(a);
    tr.append(text, url);
    return tr;
  }));
}
$('filter').addEventListener('input', render);
$('external').addEventListener('change', render);
$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(shown().map((l) => l.href).join('\n'));
  $('status').textContent = t.copied;
});
$('csv').addEventListener('click', () => {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([linksToCsv(shown())], { type: 'text/csv' })),
    download: `links-${host || 'page'}.csv`,
  });
  a.click();
});
render();
