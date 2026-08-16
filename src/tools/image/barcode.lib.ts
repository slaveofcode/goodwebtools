/**
 * Pure barcode value validation and the list of supported symbologies. Actual
 * rendering is done by JsBarcode in the island; this validates input up front so
 * the user gets a clear message instead of a thrown render error.
 */

export interface BarcodeFormat {
  id: string;
  name: string;
  hint: string;
}

export const BARCODE_FORMATS: BarcodeFormat[] = [
  { id: 'CODE128', name: 'Code 128', hint: 'Any text or digits' },
  { id: 'EAN13', name: 'EAN-13', hint: '12–13 digits' },
  { id: 'EAN8', name: 'EAN-8', hint: '7–8 digits' },
  { id: 'UPC', name: 'UPC-A', hint: '11–12 digits' },
  { id: 'CODE39', name: 'Code 39', hint: 'A–Z, 0–9, - . $ / + % space' },
  { id: 'ITF14', name: 'ITF-14', hint: '13–14 digits' },
  { id: 'MSI', name: 'MSI', hint: 'Digits only' },
  { id: 'pharmacode', name: 'Pharmacode', hint: 'Number 3–131070' },
  { id: 'codabar', name: 'Codabar', hint: 'Digits and - $ : / . +' },
];

/** Returns an error message if the value is invalid for the format, else null. */
export function validateValue(format: string, value: string): string | null {
  const v = value ?? '';
  if (v.trim() === '') return 'Enter a value to encode.';
  switch (format) {
    case 'EAN13':
      return /^\d{12,13}$/.test(v) ? null : 'EAN-13 needs 12 or 13 digits.';
    case 'EAN8':
      return /^\d{7,8}$/.test(v) ? null : 'EAN-8 needs 7 or 8 digits.';
    case 'UPC':
      return /^\d{11,12}$/.test(v) ? null : 'UPC-A needs 11 or 12 digits.';
    case 'ITF14':
      return /^\d{13,14}$/.test(v) ? null : 'ITF-14 needs 13 or 14 digits.';
    case 'MSI':
      return /^\d+$/.test(v) ? null : 'MSI accepts digits only.';
    case 'CODE39':
      return /^[0-9A-Z\-.$/+% ]+$/.test(v) ? null : 'Code 39 allows A–Z, 0–9 and - . $ / + % space.';
    case 'codabar':
      return /^[0-9\-$:/.+]+$/.test(v) ? null : 'Codabar allows digits and - $ : / . +';
    case 'pharmacode': {
      const n = Number(v);
      return Number.isInteger(n) && n >= 3 && n <= 131070 ? null : 'Pharmacode is a number from 3 to 131070.';
    }
    case 'CODE128':
    default:
      return null;
  }
}
