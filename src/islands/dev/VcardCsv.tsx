import { useState } from 'react';
import { ArrowLeftRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { Dropzone } from '@/components/ui/Dropzone';
import { downloadService } from '@/services/download';
import { parseVcards, buildVcards, contactsToCsv, csvToContacts } from '@/tools/dev/vcard.lib';
import type { Lang } from '@/i18n/config';

type Dir = 'v2c' | 'c2v';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Convert contacts between vCard (.vcf) and CSV — export your phone contacts to a spreadsheet, or build a .vcf to import. Runs in your browser; nothing is uploaded.',
    v2c: 'vCard → CSV', c2v: 'CSV → vCard', swap: 'Swap', drop: 'Drop a .vcf/.csv file or paste below',
    input: 'Input', output: 'Output', convert: 'Convert', copy: 'Copy', download: 'Download', count: (n: number) => `${n} contact${n === 1 ? '' : 's'}`,
  },
  id: {
    intro: 'Konversi kontak antara vCard (.vcf) dan CSV — ekspor kontak ponsel ke spreadsheet, atau buat .vcf untuk diimpor. Berjalan di browser Anda; tidak ada yang diunggah.',
    v2c: 'vCard → CSV', c2v: 'CSV → vCard', swap: 'Tukar', drop: 'Letakkan file .vcf/.csv atau tempel di bawah',
    input: 'Masukan', output: 'Keluaran', convert: 'Konversi', copy: 'Salin', download: 'Unduh', count: (n: number) => `${n} kontak`,
  },
};

export default function VcardCsv({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [dir, setDir] = useState<Dir>('v2c');
  const [src, setSrc] = useState('');
  const [out, setOut] = useState('');
  const [count, setCount] = useState(0);

  const convert = () => {
    if (dir === 'v2c') {
      const contacts = parseVcards(src);
      setOut(contactsToCsv(contacts));
      setCount(contacts.length);
    } else {
      const contacts = csvToContacts(src);
      setOut(buildVcards(contacts));
      setCount(contacts.length);
    }
  };

  const swap = () => { setDir(d => (d === 'v2c' ? 'c2v' : 'v2c')); setSrc(out || src); setOut(''); setCount(0); };

  const onDrop = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setSrc(await f.text());
    setOut('');
  };

  const download = () => {
    if (!out) return;
    const name = dir === 'v2c' ? 'contacts.csv' : 'contacts.vcf';
    const mime = dir === 'v2c' ? 'text/csv' : 'text/vcard';
    downloadService.download(new Blob([out], { type: mime }), name);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="border-2 border-border bg-accent px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-accent-foreground shadow-brutal-sm">
          {dir === 'v2c' ? t.v2c : t.c2v}
        </span>
        <Button variant="ghost" onClick={swap}><ArrowLeftRight className="h-4 w-4" />{t.swap}</Button>
      </div>

      <Dropzone onDrop={onDrop} accept=".vcf,.csv,text/vcard,text/csv" multiple={false}>
        <p className="text-sm font-bold">{t.drop}</p>
      </Dropzone>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.input}</span>
          <TextArea value={src} onChange={e => setSrc(e.target.value)} rows={10} className="font-mono text-xs" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.output}{count > 0 && ` · ${t.count(count)}`}</span>
            <CopyButton value={out} label={t.copy} disabled={!out} />
          </div>
          <textarea readOnly value={out} rows={10} className="w-full border-2 border-border bg-muted p-2 font-mono text-xs" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={convert} disabled={!src.trim()}>{t.convert}</Button>
        <Button variant="secondary" onClick={download} disabled={!out}><Download className="h-4 w-4" />{t.download}</Button>
      </div>
    </div>
  );
}
