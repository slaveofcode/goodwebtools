// Functions run inside the current page with chrome.scripting.executeScript.
// Chrome serialises each function on its own, so they must be self-contained:
// no imports, no outer variables — everything they need comes in as arguments.

/**
 * A small floating panel with a "Pick" button. The page's EyeDropper needs a real
 * click inside the page, which is why we ask the user to press Pick here rather
 * than opening it straight from the popup.
 */
export function colorPickerOverlay(t) {
  const ID = 'gwt-color-picker';
  document.getElementById(ID)?.remove();
  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .box{font:13px system-ui,sans-serif;background:#faf7f0;color:#0a0a0a;border:3px solid #0a0a0a;box-shadow:4px 4px 0 #0a0a0a;padding:12px;width:260px}
      .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:700}
      button{font:inherit;font-weight:700;border:2px solid #0a0a0a;cursor:pointer;padding:6px 10px}
      .pick{width:100%;background:#7c3aed;color:#fff}
      .x{background:none;border:0;font-size:16px;padding:0 4px}
      .sw{height:40px;border:2px solid #0a0a0a;margin:10px 0 6px}
      .row{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:4px;font-family:ui-monospace,monospace}
      .row button{padding:2px 8px;font-size:12px;background:#fff}
      .hint{color:#555;margin:0 0 8px}
    </style>
    <div class="box" role="dialog" aria-label="${t.title}">
      <div class="top"><span>${t.title}</span><button class="x" aria-label="${t.close}">×</button></div>
      <p class="hint">${t.hint}</p>
      <button class="pick">${t.pick}</button>
      <div class="out"></div>
    </div>`;
  const out = root.querySelector('.out');
  const close = () => host.remove();
  root.querySelector('.x').addEventListener('click', close);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
  const formats = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const [rf, gf, bf] = [r / 255, g / 255, b / 255];
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf), l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = (max === rf ? (gf - bf) / d + (gf < bf ? 6 : 0) : max === gf ? (bf - rf) / d + 2 : (rf - gf) / d + 4) * 60;
    }
    return [hex.toUpperCase(), `rgb(${r}, ${g}, ${b})`, `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`];
  };
  root.querySelector('.pick').addEventListener('click', async () => {
    if (!('EyeDropper' in window)) { out.textContent = t.unsupported; return; }
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      const hex = sRGBHex.startsWith('#') ? sRGBHex : '#' + (sRGBHex.match(/\d+/g) || []).slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('');
      out.innerHTML = '<div class="sw"></div>';
      out.firstChild.style.background = hex;
      for (const v of formats(hex)) {
        const row = document.createElement('div');
        row.className = 'row';
        const code = document.createElement('code');
        code.textContent = v;
        const copy = document.createElement('button');
        copy.textContent = t.copy;
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(v); copy.textContent = t.copied; } catch { copy.textContent = '✗'; }
          setTimeout(() => { copy.textContent = t.copy; }, 1200);
        });
        row.append(code, copy);
        out.append(row);
      }
    } catch { /* picking cancelled */ }
  });
  document.documentElement.append(host);
  return true;
}

/** Every image on the page (img, picture sources, CSS backgrounds, og:image) with its size. */
export function collectPageImages() {
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
  const largest = (srcset) => {
    let best = null, score = -1;
    for (const part of (srcset || '').split(/,\s+(?=\S)/)) {
      const [url, size = '1x'] = part.trim().split(/\s+/);
      const sc = parseFloat(size) * (size.endsWith('w') ? 1 : 1000);
      if (url && sc > score) { score = sc; best = url; }
    }
    return best;
  };
  const out = [];
  for (const img of document.images) {
    const src = abs(largest(img.srcset) || img.currentSrc || img.src);
    if (src) out.push({ src, width: img.naturalWidth, height: img.naturalHeight, alt: img.alt || '' });
  }
  for (const s of document.querySelectorAll('picture source[srcset]')) {
    const src = abs(largest(s.srcset));
    if (src) out.push({ src, width: 0, height: 0, alt: '' });
  }
  const els = document.querySelectorAll('body *');
  for (let i = 0; i < els.length && i < 4000; i++) {
    const bg = getComputedStyle(els[i]).backgroundImage;
    if (!bg || bg === 'none') continue;
    for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const src = abs(m[1]);
      if (src) out.push({ src, width: els[i].clientWidth, height: els[i].clientHeight, alt: '' });
    }
  }
  const og = document.querySelector('meta[property="og:image"]')?.content;
  if (og && abs(og)) out.push({ src: abs(og), width: 0, height: 0, alt: 'og:image' });
  return { images: out, title: document.title, url: location.href };
}

/** Page size and position, for planning a full-page capture. */
export function pageMetrics() {
  const el = document.scrollingElement || document.documentElement;
  return { scrollHeight: el.scrollHeight, innerHeight: window.innerHeight, innerWidth: window.innerWidth, dpr: window.devicePixelRatio || 1, x: window.scrollX, y: window.scrollY };
}

/**
 * Scroll to y. From the second frame on, hide fixed/sticky elements (headers,
 * cookie bars) so they don't repeat down the stitched image. Returns the real y.
 */
export function scrollForCapture(y, hideFixed) {
  window.scrollTo(0, y);
  if (hideFixed) {
    for (const el of document.querySelectorAll('body *')) {
      const pos = getComputedStyle(el).position;
      if ((pos === 'fixed' || pos === 'sticky') && !el.hasAttribute('data-gwt-hidden')) {
        el.setAttribute('data-gwt-hidden', el.style.visibility || '');
        el.style.visibility = 'hidden';
      }
    }
  }
  return window.scrollY;
}

/** Undo scrollForCapture: show hidden elements again and scroll back. */
export function restoreAfterCapture(x, y) {
  for (const el of document.querySelectorAll('[data-gwt-hidden]')) {
    el.style.visibility = el.getAttribute('data-gwt-hidden');
    el.removeAttribute('data-gwt-hidden');
  }
  window.scrollTo(x, y);
  return true;
}

/**
 * Audio and video on the page: <audio>/<video> and their <source>s, links to
 * media files, og:audio/og:video, and media the page fetched by other means
 * (from the browser's resource timing list). Classification happens later, in
 * the extension; here we only gather candidates. `streamed` is true when a
 * player plays from a blob: URL (MediaSource), i.e. there is no single file.
 *
 * Protection is read from the page itself: a player with DRM keys attached
 * (Encrypted Media Extensions, e.g. Spotify, Netflix) or one the site marked
 * `controlslist="nodownload"` is never offered, and on a DRM page nothing found
 * only in the network list is offered either.
 */
export function collectPageMedia() {
  const MEDIA = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|mka|mp4|m4v|webm|mov|mkv|ogv|avi|3gp|m3u8)(\?|#|$)/i;
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
  const out = [];
  let streamed = false;
  let drm = false;
  let restricted = 0;
  const add = (src, kind, label, type, extra) => { const u = src && abs(src); if (u) out.push({ src: u, kind, label: label || '', type: type || '', ...extra }); };
  for (const el of document.querySelectorAll('audio, video')) {
    const kind = el.tagName.toLowerCase();
    const label = el.getAttribute('title') || el.getAttribute('aria-label') || '';
    const hasDrm = !!el.mediaKeys;
    const noDownload = /\bnodownload\b/i.test(el.getAttribute('controlslist') || '');
    if (hasDrm) drm = true;
    const lock = hasDrm || noDownload ? { restricted: true } : undefined;
    if (lock) restricted++;
    for (const s of [el.currentSrc, el.getAttribute('src')]) {
      if (!s) continue;
      if (s.startsWith('blob:')) streamed = true;
      else add(s, kind, label, '', lock);
    }
    for (const s of el.querySelectorAll('source[src]')) add(s.getAttribute('src'), kind, label, s.type, lock);
  }
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (MEDIA.test(href)) add(href, null, a.textContent.trim() || a.getAttribute('download') || '');
  }
  for (const el of document.querySelectorAll('embed[src], object[data], iframe[src]')) {
    const s = el.getAttribute('src') || el.getAttribute('data');
    if (MEDIA.test(s)) add(s, null, '', el.getAttribute('type') || '');
  }
  for (const m of document.querySelectorAll('meta[property^="og:audio"], meta[property^="og:video"], meta[name="twitter:player:stream"]')) {
    const p = m.getAttribute('property') || m.getAttribute('name');
    if (/:(type|width|height|duration|alt)$/.test(p)) continue;
    add(m.getAttribute('content'), p.startsWith('og:audio') ? 'audio' : p.startsWith('og:video') ? 'video' : null, document.title);
  }
  for (const r of performance.getEntriesByType('resource')) {
    if (r.initiatorType === 'audio' || r.initiatorType === 'video') add(r.name, r.initiatorType, '', '', { via: 'network' });
    else if (MEDIA.test(r.name)) add(r.name, null, '', '', { via: 'network' });
  }
  return { media: out, streamed, drm, restricted, title: document.title, url: location.href };
}
