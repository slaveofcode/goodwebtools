// Runs on pages only when "Open data files in GoodWebTools" is on (and site
// access was granted). If the page *is* a data file — JSON (an API response, a
// .json/.jsonl file), YAML, TOML or Markdown shown as plain text — offer to open
// it in the matching viewer, or open it straight away when "automatically" is on.
(async () => {
  if (window.top !== window || document.getElementById('gwt-json-bar')) return;
  const type = (document.contentType || '').toLowerCase();
  const path = location.pathname.toLowerCase();
  const pre = document.body?.children.length === 1 && document.body.firstElementChild.tagName === 'PRE' ? document.body.firstElementChild : null;
  // Only raw documents: a JSON/YAML/TOML/Markdown type, or a plain-text page shown as one <pre>.
  if (type === 'text/html' || type.includes('xml') || !(pre || type !== 'text/plain')) return;
  const text = (pre || document.body)?.innerText || '';
  const trimmed = text.trim();
  if (!trimmed || text.length > 20 * 1024 * 1024) return;

  const parsesAsJson = () => {
    try { JSON.parse(trimmed); return true; } catch { /* maybe JSON Lines */ }
    try { JSON.parse(trimmed.split('\n', 1)[0]); return true; } catch { return false; }
  };
  const FORMATS = [
    { tool: 'json-viewer', name: 'JSON', viewer: 'JSON Viewer', type: /\bjson\b|ndjson|jsonl/, ext: /\.(json|jsonl|ndjson|geojson)$/ },
    { tool: 'yaml-viewer', name: 'YAML', viewer: 'YAML Viewer', type: /\byaml\b|\byml\b/, ext: /\.ya?ml$/ },
    { tool: 'toml-viewer', name: 'TOML', viewer: 'TOML Viewer', type: /\btoml\b/, ext: /\.toml$/ },
    { tool: 'markdown', name: 'Markdown', viewer: 'Markdown Preview', type: /\bmarkdown\b/, ext: /\.(md|markdown|mdown|mkd)$/ },
  ];
  let fmt = FORMATS.find((f) => f.type.test(type)) || FORMATS.find((f) => f.ext.test(path));
  // A .json URL served as plain text must still parse; a plain-text page with no
  // telling extension is offered only when it really parses as JSON.
  if (fmt === FORMATS[0] && !FORMATS[0].type.test(type) && !parsesAsJson()) fmt = null;
  if (!fmt && type === 'text/plain' && parsesAsJson()) fmt = FORMATS[0];
  if (!fmt) return;

  const open = (replace) => chrome.runtime.sendMessage({ type: 'open-tool', tool: fmt.tool, payload: { kind: 'text', text }, replace });

  // "Automatically": replace this tab with the viewer — but not when the user came
  // back to the raw file (Back button), or they could never leave the viewer.
  let auto = false;
  try { auto = !!(await chrome.storage?.local.get('dataAuto'))?.dataAuto; } catch { /* no storage */ }
  const back = performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
  if (auto && !back) { open(true); return; }

  const t = (k, sub) => chrome.i18n.getMessage(k, sub);
  const host = document.createElement('div');
  host.id = 'gwt-json-bar';
  host.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    .bar{display:flex;align-items:center;gap:10px;font:13px system-ui,sans-serif;background:#faf7f0;color:#0a0a0a;border:3px solid #0a0a0a;box-shadow:4px 4px 0 #0a0a0a;padding:8px 10px}
    button{font:inherit;font-weight:700;border:2px solid #0a0a0a;cursor:pointer;padding:5px 10px}
    .open{background:#7c3aed;color:#fff}.x{background:none;border:0;font-size:16px;padding:0 4px}
  </style><div class="bar" role="region"><span></span><button class="open"></button><button class="x">×</button></div>`;
  root.querySelector('span').textContent = t('dataBarText', [fmt.name]);
  root.querySelector('.open').textContent = t('dataBarOpen', [fmt.viewer]);
  root.querySelector('.x').setAttribute('aria-label', t('color_close'));
  root.querySelector('.x').addEventListener('click', () => host.remove());
  root.querySelector('.open').addEventListener('click', () => { open(false); host.remove(); });
  document.documentElement.append(host);
})();
