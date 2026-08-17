/**
 * Pure helper for the iWork viewer. Apple .pages/.numbers/.key files are ZIP
 * archives that usually embed a QuickLook preview (a PDF, sometimes an image).
 * This picks the best preview entry from the archive's file list. The unzip and
 * rendering happen in the island.
 */

export interface PreviewRef {
  path: string;
  kind: 'pdf' | 'image';
}

export function findPreview(names: string[]): PreviewRef | null {
  const entries = names.map(n => ({ orig: n, l: n.toLowerCase() }));

  // Preferred exact PDF previews.
  for (const cand of ['preview.pdf', 'quicklook/preview.pdf']) {
    const f = entries.find(e => e.l === cand);
    if (f) return { path: f.orig, kind: 'pdf' };
  }
  // Any PDF that looks like a preview/quicklook artefact.
  const anyPdf = entries.find(e => e.l.endsWith('.pdf') && (e.l.includes('preview') || e.l.includes('quicklook')));
  if (anyPdf) return { path: anyPdf.orig, kind: 'pdf' };

  // Fall back to a preview image.
  for (const cand of ['preview.jpg', 'preview-web.jpg', 'preview.png', 'quicklook/thumbnail.jpg', 'quicklook/thumbnail.png']) {
    const f = entries.find(e => e.l === cand);
    if (f) return { path: f.orig, kind: 'image' };
  }
  const anyImg = entries.find(e => (e.l.includes('preview') || e.l.includes('quicklook')) && /\.(jpe?g|png)$/.test(e.l));
  if (anyImg) return { path: anyImg.orig, kind: 'image' };

  return null;
}
