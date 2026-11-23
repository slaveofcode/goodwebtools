import { useEffect, useRef, useState } from 'react';
import { Download, VolumeX, AudioLines } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { runWithFallback, MediaInputError } from '@/tools/media/run-media.lib';
import { runFFmpeg } from '@/tools/media/encode.lib';
import { probeMedia, outputExtFor } from '@/tools/media/mb-media.lib';
import { mbMute, mbReplaceAudio, replaceTarget, ffmpegMuteArgs, ffmpegReplaceArgs } from '@/tools/media/audio-replace.lib';
import type { Engine } from '@/tools/media/engine.lib';
import type { Lang } from '@/i18n/config';
import type { SlowReason } from '@/tools/media/run-media.lib';
import { slowReasonText, mediaErrorText } from '@/tools/media/media-messages.lib';

type Mode = 'remove' | 'replace';

const TR: Record<Lang, {
  intro: string; drop: string; dropAudio: string; remove: string; replace: string; loop: string; lengthNote: string;
  runRemove: string; runReplace: string; working: string; cancel: string; download: string; failed: string; noAudio: string; noAudioFile: string;
  another: string; video: string; audio: string; fastMode: string; slowMode: string;
}> = {
  en: {
    intro: 'Mute a video, or swap its sound for another audio file. The picture is copied as it is — never re-encoded — and only the new audio is encoded. Everything happens in your browser; nothing is uploaded.',
    drop: 'Drop a video, or click to choose', dropAudio: 'Drop the new audio (or a video to take its sound from)',
    remove: 'Remove audio', replace: 'Replace audio', loop: 'Loop the new audio to fill the video',
    lengthNote: 'The new audio stops where the video ends.',
    runRemove: 'Remove audio', runReplace: 'Replace audio', working: 'Working…', cancel: 'Cancel', download: 'Download',
    failed: 'Could not process this video.', noAudio: 'This video has no audio track.', noAudioFile: 'That file has no audio to use.',
    another: 'Choose another video', video: 'Video', audio: 'New audio',
    fastMode: 'Fast mode (hardware)', slowMode: 'Compatibility mode — slower in this browser',
  },
  id: {
    intro: 'Bisukan video, atau ganti suaranya dengan file audio lain. Gambarnya disalin apa adanya — tidak pernah di-encode ulang — dan hanya audio barunya yang di-encode. Semuanya terjadi di browser Anda; tidak ada yang diunggah.',
    drop: 'Letakkan video, atau klik untuk memilih', dropAudio: 'Letakkan audio baru (atau video yang ingin diambil suaranya)',
    remove: 'Hapus audio', replace: 'Ganti audio', loop: 'Ulangi audio baru hingga memenuhi video',
    lengthNote: 'Audio baru berhenti saat video berakhir.',
    runRemove: 'Hapus audio', runReplace: 'Ganti audio', working: 'Memproses…', cancel: 'Batal', download: 'Unduh',
    failed: 'Video ini tidak bisa diproses.', noAudio: 'Video ini tidak punya trek audio.', noAudioFile: 'File itu tidak punya audio untuk dipakai.',
    another: 'Pilih video lain', video: 'Video', audio: 'Audio baru',
    fastMode: 'Mode cepat (perangkat keras)', slowMode: 'Mode kompatibilitas — lebih lambat di browser ini',
  },
};

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'video';
const extOf = (f: File) => f.name.split('.').pop() || '';

export default function AudioReplace({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [video, setVideo] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>('remove');
  const [loop, setLoop] = useState(true);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [slowWhy, setSlowWhy] = useState<SlowReason | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { setResult(null); setEngine(null); setError(''); }, [video, audio, mode, loop]);

  const run = async () => {
    if (!video || (mode === 'replace' && !audio)) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setPercent(0); setError(''); setResult(null); setEngine(null);
    const onProgress = (p: number) => setPercent(Math.min(100, Math.round(p * 100)));
    const inputExt = extOf(video);
    try {
      const probe = await probeMedia(video).catch(() => null);
      let r;
      if (mode === 'remove') {
        if (probe && !probe.audio) throw new MediaInputError('no-audio');
        const ext = outputExtFor(inputExt);
        r = await runWithFallback(
          { kind: 'mute', inputExt, needAudio: null },
          signal => mbMute(video, onProgress, signal),
          async () => ({ blob: await runFFmpeg({ in: video }, ffmpegMuteArgs(ext), { name: `out.${ext}`, mime: video.type || 'video/mp4' }, onProgress), ext }),
          ctrl.signal,
          { inputBytes: video.size },
        );
      } else {
        const target = replaceTarget(probe?.video?.codec ?? '', inputExt);
        r = await runWithFallback(
          { kind: 'replace-audio', inputExt, needAudio: target.audioCodec, inputDecodable: true },
          signal => mbReplaceAudio(video, audio!, { loop }, onProgress, signal),
          async () => ({
            blob: await runFFmpeg({ in: video, aud: audio! }, ffmpegReplaceArgs(loop, probe?.durationSec ?? 0), { name: 'out.mp4', mime: 'video/mp4' }, onProgress),
            ext: 'mp4',
          }),
          ctrl.signal,
          { inputBytes: video.size },
        );
      }
      setEngine(r.engine); setSlowWhy(r.slowReason);
      setResult({ blob: r.value.blob, name: `${baseName(video.name)}-${mode === 'remove' ? 'muted' : 'new-audio'}.${r.value.ext}` });
    } catch (e) {
      const known = mediaErrorText(e, lang);
      if (known) { setError(known); return; }
      if (e instanceof DOMException && e.name === 'AbortError') return;
      const msg = e instanceof MediaInputError ? e.message : '';
      setError(msg === 'no-audio' ? t.noAudio : msg === 'no-audio-file' ? t.noAudioFile : t.failed);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  if (!video) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.intro}</p>
        <Dropzone onDrop={f => f[0] && setVideo(f[0])} multiple={false} accept="video/*,.mkv,.mov,.ts,.mts,.avi">
          <p className="text-sm font-bold">{t.drop}</p>
        </Dropzone>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <p className="text-sm"><span className="font-bold uppercase tracking-wide text-muted-foreground">{t.video}:</span> <span className="font-mono">{video.name}</span></p>
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {(['remove', 'replace'] as const).map(m => (
          <label key={m} className={`inline-flex cursor-pointer items-center gap-2 border-2 border-border px-3 py-2 text-sm font-bold ${mode === m ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
            <input type="radio" name="audio-mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
            {m === 'remove' ? <VolumeX className="h-4 w-4" /> : <AudioLines className="h-4 w-4" />}{m === 'remove' ? t.remove : t.replace}
          </label>
        ))}
      </div>
      {mode === 'replace' && (
        <div className="space-y-2">
          {audio
            ? <p className="text-sm"><span className="font-bold uppercase tracking-wide text-muted-foreground">{t.audio}:</span> <span className="font-mono">{audio.name}</span> <Button variant="ghost" onClick={() => setAudio(null)}>×</Button></p>
            : <Dropzone onDrop={f => f[0] && setAudio(f[0])} multiple={false} accept="audio/*,video/*,.m4a,.flac,.opus,.mkv"><p className="text-sm font-bold">{t.dropAudio}</p></Dropzone>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} />{t.loop}</label>
          <p className="text-xs text-muted-foreground">{t.lengthNote}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void run()} disabled={busy || (mode === 'replace' && !audio)} data-testid="run">
          {mode === 'remove' ? t.runRemove : t.runReplace}
        </Button>
        {busy && <Button variant="ghost" onClick={() => abortRef.current?.abort()}>{t.cancel}</Button>}
      </div>
      {busy && <ProgressBar percent={percent} label={t.working} />}
      {error && <Alert variant="error">{error}</Alert>}
      {result && (
        <div className="space-y-2">
          {engine && <p data-testid="engine-line" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{engine === 'mediabunny' ? t.fastMode : t.slowMode}</p>}
          {engine === 'ffmpeg' && slowWhy && <p data-testid="slow-reason" className="text-xs text-muted-foreground">{lang === 'id' ? 'Alasan' : 'Reason'}: {slowReasonText(slowWhy, lang)}</p>}
          <Button onClick={() => downloadService.download(result.blob, result.name)}><Download className="h-4 w-4" />{t.download}</Button>
        </div>
      )}
      <Button variant="ghost" onClick={() => { setVideo(null); setAudio(null); setResult(null); }} disabled={busy}>{t.another}</Button>
    </div>
  );
}
