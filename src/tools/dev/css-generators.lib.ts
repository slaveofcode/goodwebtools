/** Pure CSS-string builders for the CSS Generator tool. */

export interface GradientStop { color: string; pos: number }

/** `linear-gradient(90deg, #fff 0%, #000 100%)` */
export function linearGradientCss(angle: number, stops: GradientStop[]): string {
  const s = stops.map(x => `${x.color} ${x.pos}%`).join(', ');
  return `linear-gradient(${angle}deg, ${s})`;
}

/** `radial-gradient(circle, #fff 0%, #000 100%)` */
export function radialGradientCss(shape: 'circle' | 'ellipse', stops: GradientStop[]): string {
  const s = stops.map(x => `${x.color} ${x.pos}%`).join(', ');
  return `radial-gradient(${shape}, ${s})`;
}

export interface BoxShadow {
  x: number; y: number; blur: number; spread: number; color: string; inset: boolean;
}

/** `inset 2px 2px 8px 0px rgba(0,0,0,0.3)` */
export function boxShadowCss(o: BoxShadow): string {
  return `${o.inset ? 'inset ' : ''}${o.x}px ${o.y}px ${o.blur}px ${o.spread}px ${o.color}`;
}

/**
 * Border-radius shorthand. Collapses to the shortest equivalent form:
 * one value when all equal, else the full four-corner list.
 */
export function borderRadiusCss(tl: number, tr: number, br: number, bl: number, unit = 'px'): string {
  const u = (n: number) => `${n}${unit}`;
  if (tl === tr && tr === br && br === bl) return u(tl);
  return `${u(tl)} ${u(tr)} ${u(br)} ${u(bl)}`;
}
