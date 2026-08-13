import { describe, it, expect } from 'vitest';
import { crc16, parseTlv, parseQris } from './qris.lib';

/** Build a valid QRIS payload from body objects, appending a correct CRC. */
function withCrc(body: string): string {
  const base = body + '6304';
  return base + crc16(base);
}

const MERCHANT_26 =
  '26' + '44' + '0014ID.CO.QRIS.WWW' + '0215ID1020012345678' + '0303UMI';

const BODY = [
  '000201',
  '010211', // static
  MERCHANT_26,
  '52045411', // MCC
  '5303360', // currency IDR
  '540512345', // amount
  '5802ID',
  '5909TOKO BUDI',
  '6007JAKARTA',
  '610512190',
  '62070703A01', // additional data: terminal A01
].join('');

const PAYLOAD = withCrc(BODY);

describe('crc16', () => {
  it('matches the CRC-16/CCITT-FALSE check vector', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
});

describe('parseTlv', () => {
  it('parses a single object', () => {
    expect(parseTlv('000201')).toEqual([
      { id: '00', length: 2, value: '01', name: expect.any(String) },
    ]);
  });

  it('parses a nested merchant-account template into children', () => {
    const tree = parseTlv(MERCHANT_26);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('26');
    expect(tree[0].children).toBeDefined();
    const nmid = tree[0].children!.find(c => c.id === '02');
    expect(nmid?.value).toBe('ID1020012345678');
  });

  it('throws on a malformed / truncated payload', () => {
    expect(() => parseTlv('0002')).toThrow();
    expect(() => parseTlv('0099AB')).toThrow(); // length overruns the string
  });
});

describe('parseQris', () => {
  const { summary } = parseQris(PAYLOAD);

  it('extracts the merchant fields', () => {
    expect(summary.merchantName).toBe('TOKO BUDI');
    expect(summary.merchantCity).toBe('JAKARTA');
    expect(summary.postalCode).toBe('12190');
    expect(summary.countryCode).toBe('ID');
  });

  it('extracts NMID, acquirer and criteria from the merchant template', () => {
    expect(summary.nmid).toBe('ID1020012345678');
    expect(summary.acquirer).toBe('ID.CO.QRIS.WWW');
    expect(summary.merchantCriteria).toBe('UMI');
  });

  it('extracts amount, MCC and currency', () => {
    expect(summary.amount).toBe('12345');
    expect(summary.mcc).toBe('5411');
    expect(summary.currency).toBe('360');
  });

  it('detects a static code', () => {
    expect(summary.initiationMethod).toBe('static');
  });

  it('validates a correct CRC', () => {
    expect(summary.crcValid).toBe(true);
  });

  it('flags a tampered CRC as invalid without throwing', () => {
    const tampered = PAYLOAD.slice(0, -1) + (PAYLOAD.slice(-1) === '0' ? '1' : '0');
    const r = parseQris(tampered);
    expect(r.summary.crcValid).toBe(false);
  });

  it('throws on structurally invalid input', () => {
    expect(() => parseQris('garbage!!')).toThrow();
  });
});
