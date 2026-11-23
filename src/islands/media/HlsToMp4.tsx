import { useEffect, useRef, useState } from 'react';
import { Download, ListVideo, Link2 } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { runWithFallback } from '@/tools/media/run-media.lib';
import { runFFmpeg } from '@/tools/media/encode.lib';
import { sortSegments, fetchHls, toMp4, mp4Name, HlsError, FFMPEG_TS_TO_MP4, type HlsReason } from '@/tools/media/hls-to-mp4.lib';
import type { Engine } from '@/tools/media/engine.lib';
import type { Lang } from '@/i18n/config';
import type { SlowReason } from '@/tools/media/run-media.lib';
import { slowReasonText, mediaErrorText } from '@/tools/media/media-messages.lib';

const TR: Record<Lang, {
  intro: string; drop: string; order: string; or: string; url: string; urlNote: string; convertFiles: string; convertUrl: string;
  fetching: (d: number, t: number) => string; packing: string; cancel: string; download: string; failed: string; clear: string;
  errors: Record<HlsReason, string>; fastMode: string; slowMode: string;
}> = {
  en: {
    intro: 'Turn an HLS stream or a set of .ts video segments into one MP4 you can play anywhere. The video and sound are copied — not re-encoded — so it’s fast and keeps the original quality. Everything happens in your browser.',
    drop: 'Drop .ts segment files (all of them), or click to choose', order: 'Joined in this order:', or: 'or paste an .m3u8 link',
    url: 'Stream link (.m3u8)', urlNote: 'Only unencrypted, finished (not live) streams from sites that allow it.',
    convertFiles: 'Join into MP4', convertUrl: 'Download as MP4',
    fetching: (d, t) => `Downloading segment ${d} of ${t}…`, packing: 'Saving as MP4…', cancel: 'Cancel', download: 'Download',
    failed: 'Could not turn this into an MP4.', clear: 'Start over',
    errors: {
      encrypted: 'This stream is encrypted, so it can’t be saved.',
      live: 'This is a live stream — only finished streams can be saved.',
      empty: 'This playlist has no video segments.',
      network: 'The site doesn’t allow downloading this stream from another page (or the link can’t be reached).',
      'not-hls': 'That link isn’t an HLS playlist (.m3u8).',
      'separate-audio': 'This stream keeps its sound in a separate track, which can’t be joined here yet — the video would come out silent.',
      byterange: 'This stream is stored as one file split by byte ranges, which isn’t supported yet.',
    },
    fastMode: 'Fast mode (hardware)', slowMode: 'Compatibility mode — slower in this browser',
  },
  id: {
    intro: 'Ubah stream HLS atau kumpulan segmen video .ts menjadi satu MP4 yang bisa diputar di mana saja. Video dan suaranya disalin — tidak di-encode ulang — jadi cepat dan kualitasnya tetap. Semuanya terjadi di browser Anda.',
    drop: 'Letakkan file segmen .ts (semuanya), atau klik untuk memilih', order: 'Digabung dengan urutan ini:', or: 'atau tempel link .m3u8',
    url: 'Link stream (.m3u8)', urlNote: 'Hanya stream yang tidak terenkripsi, sudah selesai (bukan live), dari situs yang mengizinkannya.',
    convertFiles: 'Gabungkan ke MP4', convertUrl: 'Unduh sebagai MP4',
    fetching: (d, t) => `Mengunduh segmen ${d} dari ${t}…`, packing: 'Menyimpan sebagai MP4…', cancel: 'Batal', download: 'Unduh',
    failed: 'Tidak bisa diubah menjadi MP4.', clear: 'Mulai lagi',
    errors: {
      encrypted: 'Stream ini terenkripsi, jadi tidak bisa disimpan.',
      live: 'Ini stream live — hanya stream yang sudah selesai yang bisa disimpan.',
      empty: 'Playlist ini tidak punya segmen video.',
      network: 'Situs tidak mengizinkan stream ini diunduh dari halaman lain (atau link tidak bisa dijangkau).',
      'not-hls': 'Link itu bukan playlist HLS (.m3u8).',
      'separate-audio': 'Stream ini menyimpan suaranya di trek terpisah, yang belum bisa digabung di sini — videonya akan tanpa suara.',
      byterange: 'Stream ini disimpan sebagai satu file yang dipotong per rentang byte, yang belum didukung.',
    },
    fastMode: 'Mode cepat (perangkat keras)', slowMode: 'Mode kompatibilitas — lebih lambat di browser ini',
  },
};

export default function HlsToMp4({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [percent, setPercent] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [slowWhy, setSlowWhy] = useState<SlowReason | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async (source: 'files' | 'url') => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setError(''); setResult(null); setEngine(null); setPercent(0);
    try {
      let joined: Blob;
      let name: string;
      if (source === 'files') {
        const ordered = sortSegments(files);
        joined = new Blob(ordered, { type: 'video/mp2t' });
        name = mp4Name(ordered[0].name);
      } else {
        setStage(t.fetching(0, 0));
        joined = await fetchHls(url.trim(), (d, total) => { setStage(t.fetching(d, total)); setPercent(Math.round((d / total) * 100)); }, ctrl.signal);
        name = mp4Name(url.trim());
      }
      setStage(t.packing); setPercent(0);
      const onProgress = (p: number) => setPercent(Math.min(100, Math.round(p * 100)));
      const r = await runWithFallback(
        { kind: 'transmux', inputExt: 'ts', needAudio: 'copy' },
        signal => toMp4(joined, onProgress, signal),
        () => runFFmpeg({ in: joined }, FFMPEG_TS_TO_MP4, { name: 'out.mp4', mime: 'video/mp4' }, onProgress),
        ctrl.signal,
        { inputBytes: joined.size },
      );
      setEngine(r.engine); setSlowWhy(r.slowReason);
      setResult({ blob: r.value, name });
    } catch (e) {
      const known = mediaErrorText(e, lang);
      if (known) { setError(known); return; }
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof HlsError ? t.errors[e.reason] : t.failed);
    } finally {
      setBusy(false); setStage('');
      abortRef.current = null;
    }
  };

  const ordered = sortSegments(files);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <Dropzone onDrop={f => { setFiles(f.filter(x => /\.(ts|mts|m2ts|m4s|mp4)$/i.test(x.name) || x.type === 'video/mp2t')); setResult(null); }} multiple accept=".ts,.mts,.m2ts,video/mp2t">
        <p className="text-sm font-bold">{t.drop}</p>
      </Dropzone>
      {ordered.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.order}</p>
          <ol data-testid="segment-order" className="max-h-40 list-decimal overflow-auto pl-6 font-mono text-xs">
            {ordered.map(f => <li key={f.name}>{f.name}</li>)}
          </ol>
          <Button onClick={() => void run('files')} disabled={busy}><ListVideo className="h-4 w-4" />{t.convertFiles}</Button>
        </div>
      )}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.or}</p>
        <div className="flex flex-wrap gap-2">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…/index.m3u8" aria-label={t.url}
            className="h-10 min-w-0 flex-1 border-2 border-border bg-muted px-2 text-sm" />
          <Button variant="secondary" onClick={() => void run('url')} disabled={busy || !/^https?:\/\//i.test(url.trim())}><Link2 className="h-4 w-4" />{t.convertUrl}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{t.urlNote}</p>
      </div>
      {busy && (
        <div className="space-y-2">
          <ProgressBar percent={percent} label={stage} />
          <Button variant="ghost" onClick={() => abortRef.current?.abort()}>{t.cancel}</Button>
        </div>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {result && (
        <div className="space-y-2">
          {engine && <p data-testid="engine-line" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{engine === 'mediabunny' ? t.fastMode : t.slowMode}</p>}
          {engine === 'ffmpeg' && slowWhy && <p data-testid="slow-reason" className="text-xs text-muted-foreground">{lang === 'id' ? 'Alasan' : 'Reason'}: {slowReasonText(slowWhy, lang)}</p>}
          <Button onClick={() => downloadService.download(result.blob, result.name)}><Download className="h-4 w-4" />{t.download}</Button>
        </div>
      )}
      {(files.length > 0 || result) && <Button variant="ghost" onClick={() => { setFiles([]); setResult(null); setError(''); }} disabled={busy}>{t.clear}</Button>}
    </div>
  );
}
