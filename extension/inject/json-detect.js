// Runs on pages only when "Offer the JSON Viewer on JSON pages" is on (and site
// access was granted). If the page *is* JSON — an API response, a .json/.jsonl
// file — show a small bar to open it in the GoodWebTools JSON Viewer.
(() => {
  if (window.top !== window || document.getElementById('gwt-json-bar')) return;
  const type = (document.contentType || '').toLowerCase();
  const pre = document.body?.children.length === 1 && document.body.firstElementChild.tagName === 'PRE' ? document.body.firstElementChild : null;
  const isJsonType = /\bjson\b|ndjson|jsonl/.test(type);
  if (!isJsonType && !(type === 'text/plain' && pre)) return;
  const text = (pre || document.body)?.innerText || '';
  const trimmed = text.trim();
  if (!trimmed || text.length > 20 * 1024 * 1024) return;
  if (!isJsonType) {
    // Plain text: only offer it when it really parses as JSON (or JSON Lines).
    const first = trimmed.split('\n', 1)[0];
    try { JSON.parse(trimmed); } catch { try { JSON.parse(first); } catch { return; } }
  }

  const t = (k) => chrome.i18n.getMessage(k);
  const host = document.createElement('div');
  host.id = 'gwt-json-bar';
  host.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    .bar{display:flex;align-items:center;gap:10px;font:13px system-ui,sans-serif;background:#faf7f0;color:#0a0a0a;border:3px solid #0a0a0a;box-shadow:4px 4px 0 #0a0a0a;padding:8px 10px}
    button{font:inherit;font-weight:700;border:2px solid #0a0a0a;cursor:pointer;padding:5px 10px}
    .open{background:#7c3aed;color:#fff}.x{background:none;border:0;font-size:16px;padding:0 4px}
  </style><div class="bar" role="region"><span></span><button class="open"></button><button class="x">×</button></div>`;
  root.querySelector('span').textContent = t('jsonBarText');
  root.querySelector('.open').textContent = t('jsonBarOpen');
  root.querySelector('.x').setAttribute('aria-label', t('color_close'));
  root.querySelector('.x').addEventListener('click', () => host.remove());
  root.querySelector('.open').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'open-tool', tool: 'json-viewer', payload: { kind: 'text', text } });
    host.remove();
  });
  document.documentElement.append(host);
})();
