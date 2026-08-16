/**
 * Pure unit-conversion engine. Each unit converts to/from a category base unit,
 * which handles both linear scales (length, mass, …) and affine ones
 * (temperature) uniformly. No I/O, no browser APIs.
 */
import type { Lang } from '@/i18n/config';

export interface Unit {
  id: string;
  symbol: string;
  label: Record<Lang, string>;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
}

export interface UnitCategory {
  id: string;
  label: Record<Lang, string>;
  units: Unit[];
}

/** Build a linear unit whose value is `factor` base units. */
function lin(id: string, symbol: string, en: string, id_: string, factor: number): Unit {
  return {
    id,
    symbol,
    label: { en, id: id_ },
    toBase: (v) => v * factor,
    fromBase: (v) => v / factor,
  };
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: 'length',
    label: { en: 'Length', id: 'Panjang' },
    units: [
      lin('mm', 'mm', 'Millimetre', 'Milimeter', 0.001),
      lin('cm', 'cm', 'Centimetre', 'Sentimeter', 0.01),
      lin('m', 'm', 'Metre', 'Meter', 1),
      lin('km', 'km', 'Kilometre', 'Kilometer', 1000),
      lin('in', 'in', 'Inch', 'Inci', 0.0254),
      lin('ft', 'ft', 'Foot', 'Kaki', 0.3048),
      lin('yd', 'yd', 'Yard', 'Yard', 0.9144),
      lin('mi', 'mi', 'Mile', 'Mil', 1609.344),
      lin('nmi', 'nmi', 'Nautical mile', 'Mil laut', 1852),
    ],
  },
  {
    id: 'mass',
    label: { en: 'Mass', id: 'Massa' },
    units: [
      lin('mg', 'mg', 'Milligram', 'Miligram', 1e-6),
      lin('g', 'g', 'Gram', 'Gram', 0.001),
      lin('kg', 'kg', 'Kilogram', 'Kilogram', 1),
      lin('t', 't', 'Tonne', 'Ton', 1000),
      lin('oz', 'oz', 'Ounce', 'Ons (oz)', 0.028349523125),
      lin('lb', 'lb', 'Pound', 'Pon', 0.45359237),
      lin('st', 'st', 'Stone', 'Stone', 6.35029318),
    ],
  },
  {
    id: 'temperature',
    label: { en: 'Temperature', id: 'Suhu' },
    units: [
      { id: 'C', symbol: '°C', label: { en: 'Celsius', id: 'Celsius' }, toBase: (v) => v, fromBase: (v) => v },
      { id: 'F', symbol: '°F', label: { en: 'Fahrenheit', id: 'Fahrenheit' }, toBase: (v) => (v - 32) * 5 / 9, fromBase: (v) => v * 9 / 5 + 32 },
      { id: 'K', symbol: 'K', label: { en: 'Kelvin', id: 'Kelvin' }, toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    ],
  },
  {
    id: 'area',
    label: { en: 'Area', id: 'Luas' },
    units: [
      lin('mm2', 'mm²', 'Square millimetre', 'Milimeter persegi', 1e-6),
      lin('cm2', 'cm²', 'Square centimetre', 'Sentimeter persegi', 1e-4),
      lin('m2', 'm²', 'Square metre', 'Meter persegi', 1),
      lin('ha', 'ha', 'Hectare', 'Hektare', 10000),
      lin('km2', 'km²', 'Square kilometre', 'Kilometer persegi', 1e6),
      lin('in2', 'in²', 'Square inch', 'Inci persegi', 0.00064516),
      lin('ft2', 'ft²', 'Square foot', 'Kaki persegi', 0.09290304),
      lin('acre', 'acre', 'Acre', 'Acre', 4046.8564224),
      lin('mi2', 'mi²', 'Square mile', 'Mil persegi', 2589988.110336),
    ],
  },
  {
    id: 'volume',
    label: { en: 'Volume', id: 'Volume' },
    units: [
      lin('ml', 'ml', 'Millilitre', 'Mililiter', 0.001),
      lin('l', 'l', 'Litre', 'Liter', 1),
      lin('m3', 'm³', 'Cubic metre', 'Meter kubik', 1000),
      lin('tsp', 'tsp', 'Teaspoon (US)', 'Sendok teh (US)', 0.00492892159375),
      lin('tbsp', 'tbsp', 'Tablespoon (US)', 'Sendok makan (US)', 0.01478676478125),
      lin('floz', 'fl oz', 'Fluid ounce (US)', 'Fluid ounce (US)', 0.0295735295625),
      lin('cup', 'cup', 'Cup (US)', 'Cangkir (US)', 0.2365882365),
      lin('pt', 'pt', 'Pint (US)', 'Pint (US)', 0.473176473),
      lin('qt', 'qt', 'Quart (US)', 'Quart (US)', 0.946352946),
      lin('gal', 'gal', 'Gallon (US)', 'Galon (US)', 3.785411784),
    ],
  },
  {
    id: 'speed',
    label: { en: 'Speed', id: 'Kecepatan' },
    units: [
      lin('ms', 'm/s', 'Metre / second', 'Meter / detik', 1),
      lin('kmh', 'km/h', 'Kilometre / hour', 'Kilometer / jam', 0.2777777777777778),
      lin('mph', 'mph', 'Mile / hour', 'Mil / jam', 0.44704),
      lin('knot', 'kn', 'Knot', 'Knot', 0.5144444444444445),
      lin('fts', 'ft/s', 'Foot / second', 'Kaki / detik', 0.3048),
    ],
  },
  {
    id: 'time',
    label: { en: 'Time', id: 'Waktu' },
    units: [
      lin('ms', 'ms', 'Millisecond', 'Milidetik', 0.001),
      lin('s', 's', 'Second', 'Detik', 1),
      lin('min', 'min', 'Minute', 'Menit', 60),
      lin('h', 'h', 'Hour', 'Jam', 3600),
      lin('d', 'd', 'Day', 'Hari', 86400),
      lin('wk', 'wk', 'Week', 'Minggu', 604800),
    ],
  },
  {
    id: 'digital',
    label: { en: 'Digital storage', id: 'Penyimpanan digital' },
    units: [
      lin('bit', 'bit', 'Bit', 'Bit', 0.125),
      lin('B', 'B', 'Byte', 'Byte', 1),
      lin('KB', 'KB', 'Kilobyte (1000)', 'Kilobyte (1000)', 1e3),
      lin('MB', 'MB', 'Megabyte (1000)', 'Megabyte (1000)', 1e6),
      lin('GB', 'GB', 'Gigabyte (1000)', 'Gigabyte (1000)', 1e9),
      lin('TB', 'TB', 'Terabyte (1000)', 'Terabyte (1000)', 1e12),
      lin('KiB', 'KiB', 'Kibibyte (1024)', 'Kibibyte (1024)', 1024),
      lin('MiB', 'MiB', 'Mebibyte (1024)', 'Mebibyte (1024)', 1048576),
      lin('GiB', 'GiB', 'Gibibyte (1024)', 'Gibibyte (1024)', 1073741824),
      lin('TiB', 'TiB', 'Tebibyte (1024)', 'Tebibyte (1024)', 1099511627776),
    ],
  },
];

export function getCategory(id: string): UnitCategory | undefined {
  return UNIT_CATEGORIES.find((c) => c.id === id);
}

export function convert(categoryId: string, value: number, fromId: string, toId: string): number {
  const cat = getCategory(categoryId);
  if (!cat) throw new Error(`Unknown category: ${categoryId}`);
  const from = cat.units.find((u) => u.id === fromId);
  const to = cat.units.find((u) => u.id === toId);
  if (!from) throw new Error(`Unknown unit: ${fromId}`);
  if (!to) throw new Error(`Unknown unit: ${toId}`);
  return to.fromBase(from.toBase(value));
}

/** Format a converted number for display: up to 12 significant digits, trailing zeros trimmed. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  // Use fixed notation for a readable range; fall back to precision for extremes.
  let s: string;
  if (abs >= 1e-6 && abs < 1e15) {
    s = n.toFixed(12);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  } else {
    s = n.toPrecision(12);
    if (s.includes('e')) return s;
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return s;
}
