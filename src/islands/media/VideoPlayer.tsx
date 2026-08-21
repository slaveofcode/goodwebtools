import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Camera, Subtitles, PictureInPicture2, Film, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import { usePlaylist } from '@/hooks/usePlaylist';
import { downloadService } from '@/services/download';
import { formatTime, loopSeek, resumeKey, shouldResume, SPEEDS, type Loop } from '@/tools/media/player.lib';
import { parseSubtitles, toVtt, shiftCues } from '@/tools/media/subtitle.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Play your own video files — MP4, WebM, OGV — straight from your device. Add subtitles (.srt/.vtt), grab a frame as a PNG, loop a section, and play in picture-in-picture. Nothing is uploaded.',
    drop: 'Drop video files or click to choose', dropSub: 'MP4, WebM, OGV · nothing is uploaded',
    playlist: 'Playlist', clear: 'Clear', speed: 'Speed', loopAB: 'A–B loop', setA: 'Set A', setB: 'Set B', clearLoop: 'Clear loop',
    subs: 'Subtitles', addSubs: 'Add .srt / .vtt', subsOn: 'Subtitles loaded', subOffset: 'Sync offset',
    frame: 'Save frame', pip: 'Picture-in-picture',
    unsupported: 'Skipped files this browser can’t play:', convert: 'Convert them with the Video Converter.',
    resume: 'Resume where you left off?', resumeYes: 'Resume', resumeNo: 'Start over',
    hint: 'Space play/pause · ← → seek 5s · , . step one frame · F fullscreen',
  },
  id: {
    intro: 'Putar file video Anda sendiri — MP4, WebM, OGV — langsung dari perangkat. Tambahkan subtitle (.srt/.vtt), ambil frame sebagai PNG, ulang bagian tertentu, dan putar mode picture-in-picture. Tidak ada yang diunggah.',
    drop: 'Letakkan file video atau klik untuk memilih', dropSub: 'MP4, WebM, OGV · tidak ada yang diunggah',
    playlist: 'Playlist', clear: 'Bersihkan', speed: 'Kecepatan', loopAB: 'Loop A–B', setA: 'Set A', setB: 'Set B', clearLoop: 'Hapus loop',
    subs: 'Subtitle', addSubs: 'Tambah .srt / .vtt', subsOn: 'Subtitle dimuat', subOffset: 'Geser sinkron',
    frame: 'Simpan frame', pip: 'Picture-in-picture',
    unsupported: 'File yang dilewati karena tidak didukung browser:', convert: 'Konversi dengan Video Converter.',
    resume: 'Lanjutkan dari posisi terakhir?', resumeYes: 'Lanjutkan', resumeNo: 'Mulai dari awal',
    hint: 'Spasi putar/jeda · ← → geser 5 detik · , . maju/mundur satu frame · F layar penuh',
  },
};

const RESUME_PREFIX = 'gwt-video-pos:';

export default function VideoPlayer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const pl = usePlaylist('video');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const subUrl = useRef<string>('');

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState<Loop>({ a: null, b: null });
  const [subs, setSubs] = useState('');           // object URL of the VTT track
  const [subCount, setSubCount] = useState(0);
  const [subOffset, setSubOffset] = useState(0);
  const [subText, setSubText] = useState('');     // raw text, for re-timing
  const [resumeAt, setResumeAt] = useState<number | null>(null);

  const current = pl.current;

  const applySubs = (raw: string, offset: number) => {
    const cues = shiftCues(parseSubtitles(raw), offset);
    setSubCount(cues.length);
    if (subUrl.current) URL.revokeObjectURL(subUrl.current);
    const url = URL.createObjectURL(new Blob([toVtt(cues)], { type: 'text/vtt' }));
    subUrl.current = url;
    setSubs(url);
  };

  const loadSubs = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const raw = await f.text();
    setSubText(raw);
    setSubOffset(0);
    applySubs(raw, 0);
  };

  // Re-time the loaded subtitles whenever the sync offset changes.
  useEffect(() => { if (subText) applySubs(subText, subOffset); }, [subOffset]);
  useEffect(() => () => { if (subUrl.current) URL.revokeObjectURL(subUrl.current); }, []);

  const play = async () => { try { await videoRef.current?.play(); } catch { /* blocked */ } };

  const onLoaded = () => {
    const el = videoRef.current;
    if (!el || !current) return;
    setDuration(el.duration);
    setLoop({ a: null, b: null });
    try {
      const saved = Number(localStorage.getItem(RESUME_PREFIX + resumeKey(current)));
      setResumeAt(saved && shouldResume(saved, el.duration) ? saved : null);
    } catch { setResumeAt(null); }
  };

  const onTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    setTime(el.currentTime);
    const seek = loopSeek(el.currentTime, loop);
    if (seek !== null) el.currentTime = seek;
    if (current && el.currentTime > 5) {
      try { localStorage.setItem(RESUME_PREFIX + resumeKey(current), String(el.currentTime)); } catch { /* blocked */ }
    }
  };

  const onEnded = () => {
    if (current) { try { localStorage.removeItem(RESUME_PREFIX + resumeKey(current)); } catch { /* blocked */ } }
    if (!pl.goNext()) setPlaying(false);
  };

  const wasPlaying = useRef(false);
  useEffect(() => { wasPlaying.current = playing; }, [playing]);
  useEffect(() => {
    if (current && wasPlaying.current) void play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed; }, [speed, current]);

  const seekTo = (v: number) => { const el = videoRef.current; if (el) { el.currentTime = v; setTime(v); } };
  const nudge = (d: number) => { const el = videoRef.current; if (el) seekTo(Math.max(0, Math.min(el.duration || 0, el.currentTime + d))); };

  const saveFrame = async () => {
    const el = videoRef.current;
    if (!el || !el.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(el, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/png'));
    if (blob) await downloadService.download(blob, `${current?.name ?? 'frame'}-${Math.floor(el.currentTime)}s.png`);
  };

  const togglePip = async () => {
    const el = videoRef.current as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null;
    if (!el?.requestPictureInPicture) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await el.requestPictureInPicture();
    } catch { /* unsupported / blocked */ }
  };

  // Keyboard shortcuts while a video is loaded.
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      const el = videoRef.current;
      if (!el) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); if (el.paused) void play(); else el.pause(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); nudge(5); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); nudge(-5); }
      else if (e.key === '.') { e.preventDefault(); el.pause(); nudge(1 / 30); }
      else if (e.key === ',') { e.preventDefault(); el.pause(); nudge(-1 / 30); }
      else if (e.key.toLowerCase() === 'f') { e.preventDefault(); wrapRef.current?.requestFullscreen?.().catch(() => {}); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {pl.items.length === 0 ? (
        <Dropzone onDrop={(files) => pl.add(files)} accept="video/*,.mp4,.webm,.ogv,.m4v,.mov" multiple>
          <div className="space-y-1">
            <p className="flex items-center justify-center gap-2 text-lg font-bold"><Film className="h-5 w-5" /> {t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      ) : (
        <div className="space-y-3">
          <div ref={wrapRef} className="overflow-hidden border-2 border-border bg-black">
            <video
              ref={videoRef}
              src={current?.url}
              onLoadedMetadata={onLoaded}
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onClick={() => (playing ? videoRef.current?.pause() : void play())}
              playsInline
              className="mx-auto block max-h-[70vh] w-auto max-w-full cursor-pointer"
            >
              {subs && <track kind="subtitles" src={subs} default label="Subtitles" srcLang="en" />}
            </video>
          </div>

          <input
            type="range" min={0} max={duration || 0} step={0.1} value={time}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="w-full accent-accent" aria-label="seek"
          />
          <div className="flex justify-between font-mono text-xs text-muted-foreground">
            <span>{formatTime(time)}</span><span>{formatTime(duration)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => pl.goPrev()} aria-label="previous"><SkipBack className="h-4 w-4" /></Button>
            <Button onClick={() => (playing ? videoRef.current?.pause() : void play())} aria-label={playing ? 'pause' : 'play'}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="secondary" onClick={() => { pl.goNext(); }} aria-label="next"><SkipForward className="h-4 w-4" /></Button>
            <Button variant="secondary" onClick={saveFrame}><Camera className="h-4 w-4" /> {t.frame}</Button>
            <Button variant="secondary" onClick={togglePip}><PictureInPicture2 className="h-4 w-4" /> {t.pip}</Button>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t.speed}</span>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-accent">
                {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t.loopAB}</span>
            <Button variant="secondary" onClick={() => setLoop((l) => ({ ...l, a: time }))}>{t.setA}</Button>
            <Button variant="secondary" onClick={() => setLoop((l) => ({ ...l, b: time }))}>{t.setB}</Button>
            {(loop.a !== null || loop.b !== null) && <Button variant="ghost" onClick={() => setLoop({ a: null, b: null })}>{t.clearLoop}</Button>}
            {loop.a !== null && loop.b !== null && <span className="font-mono text-xs text-accent">{formatTime(loop.a)} → {formatTime(loop.b)}</span>}
          </div>

          {/* Subtitles */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <span className="flex items-center gap-1 font-semibold"><Subtitles className="h-4 w-4" /> {t.subs}</span>
            <label className="cursor-pointer underline">
              {t.addSubs}
              <input type="file" accept=".srt,.vtt,text/vtt" className="hidden" onChange={(e) => void loadSubs(Array.from(e.target.files ?? []))} />
            </label>
            {subCount > 0 && (
              <>
                <span className="text-muted-foreground">{t.subsOn} ({subCount})</span>
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t.subOffset}</span>
                  <input
                    type="number" step={0.5} value={subOffset}
                    onChange={(e) => setSubOffset(Number(e.target.value))}
                    className="w-20 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
                  />
                  <span className="text-muted-foreground">s</span>
                </label>
              </>
            )}
          </div>

          {resumeAt !== null && (
            <Alert variant="success">
              <span className="flex flex-wrap items-center gap-2">
                {t.resume} ({formatTime(resumeAt)})
                <Button variant="secondary" onClick={() => { seekTo(resumeAt); setResumeAt(null); void play(); }}>{t.resumeYes}</Button>
                <Button variant="ghost" onClick={() => setResumeAt(null)}>{t.resumeNo}</Button>
              </span>
            </Alert>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t.playlist} ({pl.items.length})</span>
              <Button variant="ghost" size="sm" onClick={pl.clear}>{t.clear}</Button>
            </div>
            <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {pl.items.map((item, i) => (
                <li key={item.id} className={`flex items-center gap-2 px-3 py-2 text-sm ${i === pl.index ? 'bg-accent/10' : 'bg-muted/40'}`}>
                  <button type="button" onClick={() => pl.setIndex(i)} className="min-w-0 flex-1 truncate text-left">
                    {i === pl.index && <Film className="mr-1 inline h-3.5 w-3.5 text-accent" />}
                    {item.name}
                  </button>
                  <button type="button" onClick={() => pl.removeAt(i)} aria-label="remove" className="text-muted-foreground hover:text-red-600"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <Dropzone onDrop={(files) => pl.add(files)} accept="video/*,.mp4,.webm,.ogv,.m4v,.mov" multiple>
              <p className="text-sm text-muted-foreground">{t.drop}</p>
            </Dropzone>
          </div>

          <p className="text-xs text-muted-foreground">{t.hint}</p>
        </div>
      )}

      {pl.rejected.length > 0 && (
        <Alert variant="error">
          {t.unsupported} {pl.rejected.join(', ')} — <a href="/tools/video-convert" className="underline">{t.convert}</a>
        </Alert>
      )}
    </div>
  );
}
