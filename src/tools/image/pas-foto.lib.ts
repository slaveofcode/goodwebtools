/**
 * Pas foto (Indonesian ID photo) print math — pure, framework-free.
 *
 * All the geometry for sizing one photo at print resolution and tiling copies
 * onto a print sheet lives here so it can be unit-tested without a canvas or
 * PDF engine. The island does the pixel/PDF work using these numbers.
 */

/** PostScript points per centimetre (72 pt per inch ÷ 2.54 cm per inch). */
export const CM_TO_PT = 28.3464566929;

/** Print resolution for the rendered photo bitmap. */
export const DPI = 300;

const CM_PER_INCH = 2.54;

export interface PhotoSize {
  id: '2x3' | '3x4' | '4x6';
  /** width in cm (portrait: w < h). */
  w: number;
  /** height in cm. */
  h: number;
}

export const PHOTO_SIZES: PhotoSize[] = [
  { id: '2x3', w: 2, h: 3 },
  { id: '3x4', w: 3, h: 4 },
  { id: '4x6', w: 4, h: 6 },
];

export interface Sheet {
  id: '4r' | 'a4';
  label: string;
  /** width in cm. */
  w: number;
  /** height in cm. */
  h: number;
}

export const SHEETS: Sheet[] = [
  // 4R photo paper = 4×6 inch.
  { id: '4r', label: '4R (10×15 cm)', w: 10.16, h: 15.24 },
  { id: 'a4', label: 'A4 (21×29.7 cm)', w: 21.0, h: 29.7 },
];

/** Convert centimetres to PDF points. */
export function cmToPt(cm: number): number {
  return cm * CM_TO_PT;
}

/**
 * Framing guide proportions for an ID/passport-style photo, as fractions of
 * the frame height (crown/chin) and width (head oval). Roughly the ICAO/
 * passport convention: the head fills most of the frame, with a little
 * headroom above the crown. Guides are advisory — shown on the preview only.
 */
export const HEAD_GUIDE = {
  crown: 0.08,
  chin: 0.85,
  /**
   * Head breadth ÷ crown-to-chin height for an adult (~15.5cm ÷ 23cm). The
   * oval's width is DERIVED from its height with this ratio so the guide keeps
   * a head shape in every photo aspect — deriving it from the frame width
   * instead made the oval far too narrow in a 3×4 frame.
   */
  widthToHeight: 0.68,
};

/**
 * Guide geometry (crown/chin lines + head oval) for a W×H frame.
 * Pass the frame's REAL proportions (e.g. 300×400) — `rx` is in x-units and
 * `ry` in y-units, so a square viewBox stretched with preserveAspectRatio
 * would distort the oval.
 */
export function headGuideBox(w: number, h: number): {
  crownY: number;
  chinY: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
} {
  const crownY = HEAD_GUIDE.crown * h;
  const chinY = HEAD_GUIDE.chin * h;
  const ry = (chinY - crownY) / 2;
  return {
    crownY,
    chinY,
    cx: w / 2,
    cy: (crownY + chinY) / 2,
    rx: ry * HEAD_GUIDE.widthToHeight,
    ry,
  };
}

/**
 * SVG path for a head-shaped outline (an egg: widest at the temples, tapering
 * to the chin) inside the guide box — closer to a real head than a plain
 * ellipse, so it is easier to line yourself up with.
 */
export function headOutlinePath(w: number, h: number): string {
  const g = headGuideBox(w, h);
  const headH = g.chinY - g.crownY;
  const hw = g.rx; // half-width at the widest point
  // Control points in normalised head space (0 = crown, 1 = chin).
  const x = (u: number) => g.cx + u * hw;
  const y = (v: number) => g.crownY + v * headH;
  const n = (v: number) => Number(v.toFixed(2));
  return [
    `M ${n(x(0))} ${n(y(0))}`,
    `C ${n(x(0.72))} ${n(y(0))} ${n(x(1))} ${n(y(0.16))} ${n(x(1))} ${n(y(0.40))}`,
    `C ${n(x(1))} ${n(y(0.64))} ${n(x(0.66))} ${n(y(0.88))} ${n(x(0))} ${n(y(1))}`,
    `C ${n(x(-0.66))} ${n(y(0.88))} ${n(x(-1))} ${n(y(0.64))} ${n(x(-1))} ${n(y(0.40))}`,
    `C ${n(x(-1))} ${n(y(0.16))} ${n(x(-0.72))} ${n(y(0))} ${n(x(0))} ${n(y(0))}`,
    'Z',
  ].join(' ');
}

/** Pixel dimensions of one photo at the given print DPI. */
export function photoPx(wCm: number, hCm: number, dpi: number = DPI): { w: number; h: number } {
  return {
    w: Math.round((wCm / CM_PER_INCH) * dpi),
    h: Math.round((hCm / CM_PER_INCH) * dpi),
  };
}

export interface SheetLayout {
  cols: number;
  rows: number;
  count: number;
  /** Top-left corner of each tile, in cm from the sheet's top-left. */
  positions: { x: number; y: number }[];
}

/**
 * Lay out as many `photoW×photoH` tiles as fit on a `sheetW×sheetH` sheet with
 * `gap` between tiles and at least `margin` around the block. The block of
 * tiles is centred on the sheet, so the real margins are ≥ `margin`.
 */
export function sheetLayout(
  photoW: number,
  photoH: number,
  sheetW: number,
  sheetH: number,
  gap: number,
  margin: number,
): SheetLayout {
  const usableW = sheetW - 2 * margin;
  const usableH = sheetH - 2 * margin;

  const cols = Math.max(0, Math.floor((usableW + gap) / (photoW + gap)));
  const rows = Math.max(0, Math.floor((usableH + gap) / (photoH + gap)));

  if (cols === 0 || rows === 0) return { cols: 0, rows: 0, count: 0, positions: [] };

  const blockW = cols * photoW + (cols - 1) * gap;
  const blockH = rows * photoH + (rows - 1) * gap;
  const startX = (sheetW - blockW) / 2;
  const startY = (sheetH - blockH) / 2;

  const positions: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push({
        x: startX + c * (photoW + gap),
        y: startY + r * (photoH + gap),
      });
    }
  }

  return { cols, rows, count: cols * rows, positions };
}
