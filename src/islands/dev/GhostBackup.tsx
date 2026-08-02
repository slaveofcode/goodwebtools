import { useState } from 'react';
import { Ghost, Download, FileText, FileCode } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import type { Lang } from '@/i18n/config';
import {
  parseGhostExport, selectPosts, toMarkdown, toHtmlPage,
  type NormalizedPost,
} from '@/tools/dev/ghost-export.lib';

type Format = 'md' | 'html' | 'both';

const input = 'w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm';

const TR: Record<Lang, {
  intro: string; how: string; drop: string; dropSub: string;
  loaded: (n: number, d: number, p: number) => string;
  optionsH: string; drafts: string; pages: string; formatH: string;
  md: string; mdNote: string; html: string; htmlNote: string; both: string;
  imageNote: string; generate: string; working: string; another: string;
  errRead: string; errGen: string;
}> = {
  en: {
    intro: 'Turn a Ghost export into a folder of Markdown and/or standalone HTML files — one per post, with YAML frontmatter and your tags. Everything runs in your browser; nothing is uploaded.',
    how: 'In Ghost admin: Settings → Migration → Export, then drop the downloaded JSON here.',
    drop: 'Drop your Ghost export (.json)', dropSub: 'Processed on your device — no upload.',
    loaded: (n, d, p) => `${n} posts found — ${d} draft${d === 1 ? '' : 's'}, ${p} page${p === 1 ? '' : 's'}.`,
    optionsH: 'What to include', drafts: 'Include drafts (→ drafts/ folder)', pages: 'Include pages (→ pages/ folder)',
    formatH: 'Output format',
    md: 'Markdown', mdNote: '.md + YAML frontmatter (for Astro/Hugo/Jekyll…)',
    html: 'HTML', htmlNote: 'standalone .html pages (ready to host on R2/static)',
    both: 'Both',
    imageNote: 'Note: Ghost exports don’t include image files, only their URLs — so image links stay pointing at your Ghost/CDN. Save the images separately if you’re shutting the site down.',
    generate: 'Convert & download ZIP', working: 'Converting…', another: 'Choose another file',
    errRead: 'Could not read this file.', errGen: 'Could not convert the export.',
  },
  id: {
    intro: 'Ubah ekspor Ghost menjadi folder berisi berkas Markdown dan/atau HTML mandiri — satu per pos, dengan frontmatter YAML dan tag Anda. Semuanya berjalan di browser Anda; tidak ada yang diunggah.',
    how: 'Di admin Ghost: Settings → Migration → Export, lalu letakkan berkas JSON yang terunduh di sini.',
    drop: 'Letakkan ekspor Ghost Anda (.json)', dropSub: 'Diproses di perangkat Anda — tanpa unggahan.',
    loaded: (n, d, p) => `${n} pos ditemukan — ${d} draf, ${p} halaman.`,
    optionsH: 'Yang disertakan', drafts: 'Sertakan draf (→ folder drafts/)', pages: 'Sertakan halaman (→ folder pages/)',
    formatH: 'Format keluaran',
    md: 'Markdown', mdNote: '.md + frontmatter YAML (untuk Astro/Hugo/Jekyll…)',
    html: 'HTML', htmlNote: 'halaman .html mandiri (siap dihosting di R2/statis)',
    both: 'Keduanya',
    imageNote: 'Catatan: ekspor Ghost tidak menyertakan berkas gambar, hanya URL-nya — jadi tautan gambar tetap mengarah ke Ghost/CDN Anda. Simpan gambar secara terpisah jika Anda menutup situs.',
    generate: 'Konversi & unduh ZIP', working: 'Mengonversi…', another: 'Pilih berkas lain',
    errRead: 'Tidak dapat membaca berkas ini.', errGen: 'Tidak dapat mengonversi ekspor.',
  },
};

export default function GhostBackup({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [posts, setPosts] = useState<NormalizedPost[] | null>(null);
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [includePages, setIncludePages] = useState(true);
  const [format, setFormat] = useState<Format>('md');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    setError('');
    const f = files[0];
    if (!f) return;
    try {
      setPosts(parseGhostExport(await f.text()));
    } catch (e) {
      setPosts(null);
      setError(e instanceof Error ? e.message : t.errRead);
    }
  };

  const generate = async () => {
    if (!posts) return;
    setError('');
    setBusy(true);
    try {
      const selected = selectPosts(posts, { includeDrafts, includePages });
      const files: Record<string, Uint8Array> = {};
      const enc = new TextEncoder();

      if (format === 'md' || format === 'both') {
        const [{ default: Turndown }, gfm] = await Promise.all([
          import('turndown'),
          import('@joplin/turndown-plugin-gfm'),
        ]);
        const td = new Turndown({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' });
        td.use((gfm as { gfm: (s: unknown) => void }).gfm);
        const htmlToMd = (html: string) => td.turndown(html);
        for (const p of selected) {
          const { path, content } = toMarkdown(p, htmlToMd);
          files[path] = enc.encode(content);
        }
      }
      if (format === 'html' || format === 'both') {
        for (const p of selected) {
          const { path, content } = toHtmlPage(p);
          files[path] = enc.encode(content);
        }
      }

      const { zipSync } = await import('fflate');
      const zipped = zipSync(files, { level: 6 });
      downloadService.download(new Blob([zipped], { type: 'application/zip' }), 'ghost-backup.zip');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errGen);
    } finally {
      setBusy(false);
    }
  };

  const counts = posts
    ? { total: posts.length, drafts: posts.filter(p => p.status !== 'published').length, pages: posts.filter(p => p.type === 'page').length }
    : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!posts && (
        <>
          <Dropzone onDrop={onDrop} accept=".json,application/json" multiple={false}>
            <div className="space-y-1">
              <p className="flex items-center justify-center gap-2 text-lg font-bold"><Ghost className="h-5 w-5" /> {t.drop}</p>
              <p className="text-sm text-muted-foreground">{t.dropSub}</p>
            </div>
          </Dropzone>
          <p className="text-xs text-muted-foreground">{t.how}</p>
        </>
      )}

      {posts && counts && (
        <div className="space-y-4">
          <Alert variant="success">{t.loaded(counts.total, counts.drafts, counts.pages)}</Alert>

          <div className="space-y-2 border-2 border-border p-3">
            <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.optionsH}</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeDrafts} onChange={e => setIncludeDrafts(e.target.checked)} /> {t.drafts}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includePages} onChange={e => setIncludePages(e.target.checked)} /> {t.pages}</label>
          </div>

          <div className="space-y-2 border-2 border-border p-3">
            <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.formatH}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {([['md', FileText, t.md, t.mdNote], ['html', FileCode, t.html, t.htmlNote], ['both', Download, t.both, '']] as const).map(([val, Icon, label, note]) => (
                <button key={val} type="button" onClick={() => setFormat(val)} aria-pressed={format === val}
                  className={`flex flex-col gap-1 border-2 border-border p-2 text-left text-sm press-brutal ${format === val ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
                  <span className="flex items-center gap-1.5 font-bold"><Icon className="h-4 w-4" /> {label}</span>
                  {note && <span className={format === val ? 'text-accent-foreground/80' : 'text-muted-foreground'}>{note}</span>}
                </button>
              ))}
            </div>
          </div>

          <p className="border-2 border-border bg-muted px-3 py-2 text-xs text-muted-foreground">{t.imageNote}</p>

          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={busy}><Download className="h-4 w-4" /> {busy ? t.working : t.generate}</Button>
            <Button variant="secondary" onClick={() => { setPosts(null); setError(''); }}>{t.another}</Button>
          </div>
        </div>
      )}

      {!posts && error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
