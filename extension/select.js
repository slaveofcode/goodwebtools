// Region-select overlay for a hotkey-initiated capture. Reads the stashed PNG,
// lets the user drag a crop rectangle, then downloads or copies the result — all
// locally, nothing leaves the machine.

const els = {
  empty: document.getElementById('empty'),
  stage: document.getElementById('stage'),
  controls: document.getElementById('controls'),
  img: document.getElementById('shot'),
  sel: document.getElementById('sel'),
  frame: document.getElementById('frame'),
  fmt: document.getElementById('fmt'),
  crop: document.getElementById('crop'),
  full: document.getElementById('full'),
  copy: document.getElementById('copy'),
  status: document.getElementById('status'),
};

let capture = null; // { dataUrl, width, height }
let sel = null; // { x, y, w, h } in displayed px
let drag = null;

async function init() {
  const { pendingCapture } = await chrome.storage.session.get('pendingCapture');
  if (!pendingCapture) {
    els.empty.hidden = false;
    return;
  }
  capture = pendingCapture;
  await chrome.storage.session.remove('pendingCapture');
  els.img.src = capture.dataUrl;
  els.stage.hidden = false;
  els.controls.hidden = false;
}

function pos(e) {
  const r = els.img.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(r.width, e.clientX - r.left)),
    y: Math.max(0, Math.min(r.height, e.clientY - r.top)),
  };
}

els.img.addEventListener('pointerdown', (e) => {
  els.img.setPointerCapture(e.pointerId);
  const p = pos(e);
  drag = p;
  sel = { x: p.x, y: p.y, w: 0, h: 0 };
  updateSel();
});
els.img.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = pos(e);
  sel = {
    x: Math.min(drag.x, p.x),
    y: Math.min(drag.y, p.y),
    w: Math.abs(p.x - drag.x),
    h: Math.abs(p.y - drag.y),
  };
  updateSel();
});
els.img.addEventListener('pointerup', () => {
  drag = null;
  els.crop.disabled = !(sel && sel.w > 4 && sel.h > 4);
});

function updateSel() {
  if (!sel || sel.w <= 0 || sel.h <= 0) {
    els.sel.hidden = true;
    return;
  }
  els.sel.hidden = false;
  els.sel.style.left = sel.x + 'px';
  els.sel.style.top = sel.y + 'px';
  els.sel.style.width = sel.w + 'px';
  els.sel.style.height = sel.h + 'px';
}

function render(crop, forceType) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const source = new Image();
  return new Promise((resolve) => {
    source.onload = () => {
      if (crop && sel && sel.w > 4 && sel.h > 4) {
        const scaleX = capture.width / els.img.clientWidth;
        const scaleY = capture.height / els.img.clientHeight;
        canvas.width = Math.round(sel.w * scaleX);
        canvas.height = Math.round(sel.h * scaleY);
        ctx.drawImage(source, sel.x * scaleX, sel.y * scaleY, sel.w * scaleX, sel.h * scaleY, 0, 0, canvas.width, canvas.height);
      } else {
        canvas.width = capture.width;
        canvas.height = capture.height;
        ctx.drawImage(source, 0, 0);
      }
      const type = forceType || (els.fmt.value === 'jpg' ? 'image/jpeg' : 'image/png');
      canvas.toBlob((blob) => resolve(blob), type, type === 'image/jpeg' ? 0.92 : undefined);
    };
    source.src = capture.dataUrl;
  });
}

async function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `screenshot.${els.fmt.value}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function flash(text) {
  els.status.textContent = text;
  setTimeout(() => (els.status.textContent = ''), 2000);
}

els.crop.addEventListener('click', async () => downloadBlob(await render(true)));
els.full.addEventListener('click', async () => downloadBlob(await render(false)));
els.copy.addEventListener('click', async () => {
  try {
    // Clipboard images must be PNG; copy the current crop (or full frame).
    const png = await render(!!(sel && sel.w > 4), 'image/png');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    flash('Copied ✓');
  } catch (e) {
    flash('Copy failed');
  }
});

init();
