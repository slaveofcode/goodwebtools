import { describe, it, expect } from 'vitest';
import {
  previewKindOf, formatSize, mimeToExtension, parseDataTransfer,
} from './clipboard.lib';

// ─── previewKindOf ────────────────────────────────────────────────────────────

describe('previewKindOf', () => {
  it.each([
    ['text/plain',          'text'],
    ['text/html',           'html'],
    ['image/png',           'image'],
    ['image/jpeg',          'image'],
    ['image/gif',           'image'],
    ['image/webp',          'image'],
    ['video/mp4',           'video'],
    ['video/webm',          'video'],
    ['audio/mpeg',          'audio'],
    ['audio/wav',           'audio'],
    ['application/pdf',     'pdf'],
    ['application/zip',     'binary'],
    ['application/octet-stream', 'binary'],
    ['text/csv',            'binary'],
  ] as const)('%s → %s', (mime, expected) => {
    expect(previewKindOf(mime)).toBe(expected);
  });

  it('handles MIME types with parameters', () => {
    expect(previewKindOf('text/plain; charset=utf-8')).toBe('text');
    expect(previewKindOf('image/png; name=foo.png')).toBe('image');
  });
});

// ─── formatSize ──────────────────────────────────────────────────────────────

describe('formatSize', () => {
  it.each([
    [0,          '0 B'],
    [512,        '512 B'],
    [1023,       '1023 B'],
    [1024,       '1.0 KB'],
    [1536,       '1.5 KB'],
    [1048576,    '1.0 MB'],
    [1572864,    '1.5 MB'],
  ])('%i bytes → %s', (bytes, expected) => {
    expect(formatSize(bytes)).toBe(expected);
  });
});

// ─── mimeToExtension ──────────────────────────────────────────────────────────

describe('mimeToExtension', () => {
  it.each([
    ['text/plain',   'txt'],
    ['text/html',    'html'],
    ['image/png',    'png'],
    ['image/jpeg',   'jpg'],
    ['video/mp4',    'mp4'],
    ['audio/mpeg',   'mp3'],
    ['application/pdf', 'pdf'],
    ['application/octet-stream', 'octet-stream'],
  ])('%s → %s', (mime, ext) => {
    expect(mimeToExtension(mime)).toBe(ext);
  });
});

// ─── parseDataTransfer ───────────────────────────────────────────────────────

function makeDataTransfer(items: { kind: 'string' | 'file'; type: string; value: string | File }[]): DataTransfer {
  const dtItems: DataTransferItem[] = items.map(({ kind, type, value }) => ({
    kind,
    type,
    getAsFile: () => (kind === 'file' ? (value as File) : null),
    getAsString: () => {},
    webkitGetAsEntry: () => null,
  } as unknown as DataTransferItem));

  const types = items.map(i => (i.kind === 'file' ? 'Files' : i.type));
  const stringMap = new Map(
    items.filter(i => i.kind === 'string').map(i => [i.type, i.value as string]),
  );

  return {
    items: dtItems as unknown as DataTransferItemList,
    files: { length: 0 } as unknown as FileList,
    types,
    getData: (t: string) => stringMap.get(t) ?? '',
  } as unknown as DataTransfer;
}

describe('parseDataTransfer', () => {
  it('extracts plain text', () => {
    const dt = makeDataTransfer([{ kind: 'string', type: 'text/plain', value: 'hello world' }]);
    const result = parseDataTransfer(dt);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('text');
    expect(result[0].text).toBe('hello world');
    expect(result[0].type).toBe('text/plain');
  });

  it('extracts HTML alongside plain text, deduplicates types', () => {
    const dt = makeDataTransfer([
      { kind: 'string', type: 'text/plain', value: 'plain' },
      { kind: 'string', type: 'text/html', value: '<b>bold</b>' },
    ]);
    const result = parseDataTransfer(dt);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.kind === 'html')?.text).toBe('<b>bold</b>');
  });

  it('extracts a file item and creates a blobUrl placeholder', () => {
    // jsdom doesn't implement URL.createObjectURL — stub it
    (globalThis as Record<string, unknown>).URL = {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => {},
    };
    const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' });
    const dt = makeDataTransfer([{ kind: 'file', type: 'video/mp4', value: file }]);
    const result = parseDataTransfer(dt);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('video');
    expect(result[0].blobUrl).toBeDefined();
    expect(result[0].filename).toBe('clip.mp4');
  });

  it('returns empty array for empty DataTransfer', () => {
    const dt = makeDataTransfer([]);
    expect(parseDataTransfer(dt)).toHaveLength(0);
  });

  it('deduplicates entries with the same MIME type', () => {
    const dt = makeDataTransfer([
      { kind: 'string', type: 'text/plain', value: 'a' },
      { kind: 'string', type: 'text/plain', value: 'b' },
    ]);
    expect(parseDataTransfer(dt)).toHaveLength(1);
  });
});
