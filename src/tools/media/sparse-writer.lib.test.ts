import { describe, it, expect } from 'vitest';
import { SparseFileWriter } from './sparse-writer.lib';

const bytes = (...n: number[]) => new Uint8Array(n);
const read = async (w: SparseFileWriter) => [...new Uint8Array(await w.toBlob('x/y').arrayBuffer())];

describe('SparseFileWriter — builds the output file from positioned writes, no single big buffer', () => {
  it('appends sequential writes', async () => {
    const w = new SparseFileWriter();
    w.write(bytes(1, 2), 0); w.write(bytes(3), 2);
    expect(await read(w)).toEqual([1, 2, 3]);
    expect(w.size).toBe(3);
  });
  it('patches bytes inside an earlier write (e.g. an MP4 box size written at the end)', async () => {
    const w = new SparseFileWriter();
    w.write(bytes(0, 0, 0, 0, 9, 9), 0); w.write(bytes(7, 7), 1);
    expect(await read(w)).toEqual([0, 7, 7, 0, 9, 9]);
  });
  it('patches across two earlier writes and extends past the end', async () => {
    const w = new SparseFileWriter();
    w.write(bytes(1, 1), 0); w.write(bytes(2, 2), 2); w.write(bytes(5, 5, 5, 5), 1);
    expect(await read(w)).toEqual([1, 5, 5, 5, 5]);
  });
  it('fills a gap with zeros', async () => {
    const w = new SparseFileWriter();
    w.write(bytes(1), 0); w.write(bytes(4), 3);
    expect(await read(w)).toEqual([1, 0, 0, 4]);
  });
  it('keeps its own copy of the data', async () => {
    const w = new SparseFileWriter();
    const d = bytes(1, 2);
    w.write(d, 0); d[0] = 9;
    expect(await read(w)).toEqual([1, 2]);
  });
});
