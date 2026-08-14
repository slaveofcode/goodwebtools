import { useMemo, useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { DownloadTextButton } from '@/components/ui/DownloadTextButton';
import { Dropzone } from '@/components/ui/Dropzone';
import { parseSubtitles, toSrt, toVtt, shiftCues } from '@/tools/media/subtitle.lib';
import type { Lang } from '@/i18n/config';

const EXAMPLE = `1
00:00:01,000 --> 00:00:04,000
Welcome to GoodWebTools

2
00:00:05,000 --> 00:00:08,500
Edit, retime and convert subtitles`;

const TR: Record<Lang, {
  intro: string;
  drop: string;
  source: string;
  cues: (n: number) => string;
  shift: string;
  applyShift: string;
  srt: string;
  vtt: string;
  example: string;
}> = {
  en: {
    intro: 'Edit, retime and convert subtitles between SRT and WebVTT — paste or drop a .srt/.vtt file. Everything stays in your browser.',
    drop: 'Drop a .srt or .vtt file, or paste below',
    source: 'Subtitle source (SRT or VTT)',
    cues: n => `${n} ${n === 1 ? 'cue' : 'cues'} parsed`,
    shift: 'Shift all (seconds)',
    applyShift: 'Apply shift',
    srt: 'SRT output',
    vtt: 'WebVTT output',
    example: 'Load example',
  },
  id: {
    intro: 'Edit, atur ulang waktu, dan konversi subtitle antara SRT dan WebVTT — tempel atau letakkan file .srt/.vtt. Semuanya tetap di browser Anda.',
    drop: 'Letakkan file .srt atau .vtt, atau tempel di bawah',
    source: 'Sumber subtitle (SRT atau VTT)',
    cues: n => `${n} cue ter-parse`,
    shift: 'Geser semua (detik)',
    applyShift: 'Terapkan geser',
    srt: 'Keluaran SRT',
    vtt: 'Keluaran WebVTT',
    example: 'Muat contoh',
  },
};

export default function SubtitleEditor({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [input, setInput] = useState('');
  const [shift, setShift] = useState(0);

  const cues = useMemo(() => parseSubtitles(input), [input]);
  const srt = useMemo(() => toSrt(cues), [cues]);
  const vtt = useMemo(() => toVtt(cues), [cues]);

  const onDrop = async (files: File[]) => {
    if (files[0]) setInput(await files[0].text());
  };

  const applyShift = () => {
    if (cues.length) setInput(toSrt(shiftCues(cues, shift)));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <Dropzone onDrop={onDrop} accept=".srt,.vtt,text/plain" multiple={false}>
        <p className="text-sm">{t.drop}</p>
      </Dropzone>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t.source}</span>
          <button type="button" onClick={() => setInput(EXAMPLE)} className="text-sm text-accent underline">
            {t.example}
          </button>
        </div>
        <TextArea value={input} onChange={e => setInput(e.target.value)} rows={8} spellCheck={false} />
        <p className="text-xs text-muted-foreground">{t.cues(cues.length)}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">{t.shift}</span>
          <input type="number" step={0.1} value={shift} onChange={e => setShift(Number(e.target.value))}
            className="w-28 border-2 border-border bg-muted p-2 text-sm" />
        </label>
        <Button variant="secondary" onClick={applyShift} disabled={!cues.length}>{t.applyShift}</Button>
      </div>

      {cues.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[{ label: t.srt, text: srt, name: 'subtitles.srt', mime: 'text/plain' },
            { label: t.vtt, text: vtt, name: 'subtitles.vtt', mime: 'text/vtt' }].map(o => (
            <div key={o.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{o.label}</span>
                <div className="flex gap-2">
                  <DownloadTextButton text={o.text} filename={o.name} mime={o.mime} />
                  <CopyButton value={o.text} />
                </div>
              </div>
              <TextArea value={o.text} readOnly rows={8} spellCheck={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
