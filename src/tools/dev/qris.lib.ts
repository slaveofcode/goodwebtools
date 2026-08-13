/**
 * QRIS / EMVCo Merchant-Presented-Mode QR decoder — pure, framework-free.
 *
 * The payload is a run of TLV objects: ID(2) + LEN(2, decimal) + VALUE(LEN).
 * Merchant-account (26–51), additional-data (62) and language (64) templates
 * nest more TLV objects. `parseQris` builds the tree, derives a friendly
 * summary, and validates the CRC-16/CCITT-FALSE checksum in tag 63.
 */

export interface Tlv {
  id: string;
  length: number;
  value: string;
  name: string;
  children?: Tlv[];
}

export interface QrisSummary {
  payloadFormat?: string;
  initiationMethod: 'static' | 'dynamic' | 'unknown';
  merchantName?: string;
  merchantCity?: string;
  postalCode?: string;
  countryCode?: string;
  currency?: string;
  amount?: string;
  mcc?: string;
  nmid?: string;
  merchantPan?: string;
  merchantCriteria?: string;
  acquirer?: string;
  crc?: string;
  crcValid: boolean;
}

export interface QrisResult {
  summary: QrisSummary;
  tree: Tlv[];
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) → 4 upper-hex chars. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const ROOT_NAMES: Record<string, string> = {
  '00': 'Payload Format Indicator',
  '01': 'Point of Initiation Method',
  '52': 'Merchant Category Code',
  '53': 'Transaction Currency',
  '54': 'Transaction Amount',
  '55': 'Tip or Convenience Indicator',
  '56': 'Value of Convenience Fee (Fixed)',
  '57': 'Value of Convenience Fee (Percentage)',
  '58': 'Country Code',
  '59': 'Merchant Name',
  '60': 'Merchant City',
  '61': 'Postal Code',
  '62': 'Additional Data Field Template',
  '63': 'CRC',
  '64': 'Merchant Information — Language Template',
};

const MERCHANT_SUBTAG: Record<string, string> = {
  '00': 'Globally Unique Identifier',
  '01': 'Merchant PAN',
  '02': 'Merchant ID (NMID)',
  '03': 'Merchant Criteria',
};

const ADDITIONAL_SUBTAG: Record<string, string> = {
  '01': 'Bill Number',
  '02': 'Mobile Number',
  '03': 'Store Label',
  '04': 'Loyalty Number',
  '05': 'Reference Label',
  '06': 'Customer Label',
  '07': 'Terminal Label',
  '08': 'Purpose of Transaction',
  '09': 'Additional Consumer Data Request',
};

const LANGUAGE_SUBTAG: Record<string, string> = {
  '00': 'Language Preference',
  '01': 'Merchant Name — Alternate Language',
  '02': 'Merchant City — Alternate Language',
};

function isMerchantAccount(id: string): boolean {
  const n = Number(id);
  return n >= 26 && n <= 51;
}

function isNested(id: string): boolean {
  return isMerchantAccount(id) || id === '62' || id === '64';
}

function nameFor(parentId: string | null, id: string): string {
  if (parentId === null) {
    if (ROOT_NAMES[id]) return ROOT_NAMES[id];
    if (isMerchantAccount(id)) return 'Merchant Account Information';
    return 'Reserved';
  }
  if (isMerchantAccount(parentId)) return MERCHANT_SUBTAG[id] ?? 'Data';
  if (parentId === '62') return ADDITIONAL_SUBTAG[id] ?? 'Data';
  if (parentId === '64') return LANGUAGE_SUBTAG[id] ?? 'Data';
  return 'Data';
}

interface RawTlv {
  id: string;
  length: number;
  value: string;
}

/** Flat TLV scan; throws on malformed length or overrun. */
function scan(s: string): RawTlv[] {
  const out: RawTlv[] = [];
  let i = 0;
  while (i < s.length) {
    if (i + 4 > s.length) throw new Error(`Truncated tag at position ${i}`);
    const id = s.slice(i, i + 2);
    const lenStr = s.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lenStr)) {
      throw new Error(`Invalid TLV header "${id}${lenStr}" at position ${i}`);
    }
    const length = Number(lenStr);
    const value = s.slice(i + 4, i + 4 + length);
    if (value.length < length) throw new Error(`Length overrun at tag ${id}`);
    out.push({ id, length, value });
    i += 4 + length;
  }
  if (out.length === 0) throw new Error('No TLV objects found');
  return out;
}

function build(objs: RawTlv[], parentId: string | null): Tlv[] {
  return objs.map(({ id, length, value }) => {
    const node: Tlv = { id, length, value, name: nameFor(parentId, id) };
    if (isNested(id)) {
      try {
        node.children = build(scan(value), id);
      } catch {
        // Not clean nested TLV — keep it as a leaf.
      }
    }
    return node;
  });
}

/** Parse a payload into a TLV tree. Throws on structurally invalid input. */
export function parseTlv(s: string): Tlv[] {
  return build(scan(s), null);
}

function findMerchantTemplate(tree: Tlv[]): Tlv | undefined {
  const templates = tree.filter(t => isMerchantAccount(t.id) && t.children);
  const qris = templates.find(t =>
    (t.children!.find(c => c.id === '00')?.value ?? '').toUpperCase().includes('ID.CO.QRIS'),
  );
  return qris ?? templates[0];
}

/** Decode a QRIS payload into a summary + full TLV tree. */
export function parseQris(payload: string): QrisResult {
  const clean = payload.trim();
  const tree = parseTlv(clean);
  const root = (id: string) => tree.find(t => t.id === id)?.value;

  const initRaw = root('01');
  const initiationMethod: QrisSummary['initiationMethod'] =
    initRaw === '11' ? 'static' : initRaw === '12' ? 'dynamic' : 'unknown';

  const merchant = findMerchantTemplate(tree);
  const sub = (id: string) => merchant?.children?.find(c => c.id === id)?.value;

  // CRC covers everything up to and including the "6304" tag+length.
  let crcValid = false;
  let crc = tree.find(t => t.id === '63')?.value;
  if (clean.length >= 8 && clean.slice(-8, -4) === '6304') {
    const provided = clean.slice(-4).toUpperCase();
    crc = provided;
    crcValid = crc16(clean.slice(0, -4)) === provided;
  }

  const summary: QrisSummary = {
    payloadFormat: root('00'),
    initiationMethod,
    merchantName: root('59'),
    merchantCity: root('60'),
    postalCode: root('61'),
    countryCode: root('58'),
    currency: root('53'),
    amount: root('54'),
    mcc: root('52'),
    acquirer: sub('00'),
    merchantPan: sub('01'),
    nmid: sub('02'),
    merchantCriteria: sub('03'),
    crc,
    crcValid,
  };

  return { summary, tree };
}
