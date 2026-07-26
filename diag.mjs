import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
const bytes = await readFile(process.env.HOME + '/Downloads/sample-tables.pdf');
// suppress the noisy warnings, just get outcome
const origWarn = console.warn, origLog = console.log;
try {
  const d = await PDFDocument.load(bytes, { ignoreEncryption: true });
  origLog('LOAD OK -> pages:', d.getPageCount());
  // try a merge/copy roundtrip
  const out = await PDFDocument.create();
  const cp = await out.copyPages(d, d.getPageIndices());
  cp.forEach(p=>out.addPage(p));
  const saved = await out.save();
  origLog('COPY+SAVE OK -> bytes:', saved.length);
} catch(e){ origLog('FAILED:', e.constructor.name, '-', e.message); }
