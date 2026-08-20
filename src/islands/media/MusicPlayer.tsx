import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Music, X, Disc3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import { usePlaylist } from '@/hooks/usePlaylist';
import { formatTime, loopSeek, resumeKey, shouldResume, SPEEDS, type Loop } from '@/tools/media/player.lib';
import { parseId3, type Id3Tags } from '@/tools/media/id3.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Play your own music files — MP3, WAV, M4A, FLAC, OGG — straight from your device. Build a playlist, see album art from the file’s tags, and watch a live visualizer. Your files never leave your browser; nothing is uploaded.',
    drop: 'Drop music files or click to choose', dropSub: 'MP3, WAV, M4A, AAC, FLAC, OGG · nothing is uploaded',
    playlist: 'Playlist', clear: 'Clear', speed: 'Speed', loopAB: 'A–B loop', setA: 'Set A', setB: 'Set B', clearLoop: 'Clear loop',
    unsupported: 'Skipped files this browser can’t play:', convert: 'Convert them with the Audio Converter.',
    resume: 'Resume where you left off?', resumeYes: 'Resume', resumeNo: 'Start over',
    empty: 'No tracks yet — add some music to start.',
  },
  id: {
    intro: 'Putar file musik Anda sendiri — MP3, WAV, M4A, FLAC, OGG — langsung dari perangkat. Buat playlist, lihat sampul album dari tag file, dan nikmati visualizer langsung. File Anda tidak pernah meninggalkan browser; tidak ada yang diunggah.',
    drop: 'Letakkan file musik atau klik untuk memilih', dropSub: 'MP3, WAV, M4A, AAC, FLAC, OGG · tidak ada yang diunggah',
    playlist: 'Playlist', clear: 'Bersihkan', speed: 'Kecepatan', loopAB: 'Loop A–B', setA: 'Set A', setB: 'Set B', clearLoop: 'Hapus loop',
    unsupported: 'File yang dilewati karena tidak didukung browser:', convert: 'Konversi dengan Audio Converter.',
    resume: 'Lanjutkan dari posisi terakhir?', resumeYes: 'Lanjutkan', resumeNo: 'Mulai dari awal',
    empty: 'Belum ada lagu — tambahkan musik untuk mulai.',
  },
};

const RESUME_PREFIX = 'gwt-music-pos:';

export default function MusicPlayer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const pl = usePlaylist('audio');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const artUrl = useRef<string>('');

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState<Loop>({ a: null, b: null });
  const [tags, setTags] = useState<Id3Tags>({});
  const [art, setArt] = useState('');
  const [resumeAt, setResumeAt] = useState<number | null>(null);

  const current = pl.current;

  // Read ID3 tags (first 512 KB is plenty for the tag + cover art).
  useEffect(() => {
    let alive = true;
    setTags({});
    if (artUrl.current) { URL.revokeObjectURL(artUrl.current); artUrl.current = ''; }
    setArt('');
    if (!current) return;
    current.file.slice(0, 512 * 1024).arrayBuffer().then((buf) => {
      if (!alive) return;
      const parsed = parseId3(new Uint8Array(buf));
      setTags(parsed);
      if (parsed.picture) {
        const url = URL.createObjectURL(new Blob([parsed.picture.data as BlobPart], { type: parsed.picture.mime }));
        artUrl.current = url;
        setArt(url);
      }
    }).catch(() => { /* not an MP3 / unreadable — filename fallback */ });
    return () => { alive = false; };
  }, [current]);

  useEffect(() => () => { if (artUrl.current) URL.revokeObjectURL(artUrl.current); }, []);

  // Visualizer: one AudioContext for the lifetime of the element.
  const ensureAnalyser = useCallback(() => {
    const el = audioRef.current;
    if (!el || ctxRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
    } catch { /* visualizer is optional */ }
  }, []);

  useEffect(() => () => { ctxRef.current?.close().catch(() => {}); if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      const g = canvas?.getContext('2d');
      if (canvas && g) {
        const w = canvas.width, h = canvas.height;
        g.clearRect(0, 0, w, h);
        if (analyser) {
          const bins = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(bins);
          const barW = w / bins.length;
          for (let i = 0; i < bins.length; i++) {
            const v = bins[i] / 255;
            g.fillStyle = `hsl(${280 - v * 80} 85% ${35 + v * 25}%)`;
            g.fillRect(i * barW, h - v * h, Math.max(1, barW - 1), v * h);
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const play = async () => {
    const el = audioRef.current;
    if (!el) return;
    ensureAnalyser();
    if (ctxRef.current?.state === 'suspended') await ctxRef.current.resume();
    try { await el.play(); } catch { /* blocked */ }
  };

  const onLoaded = () => {
    const el = audioRef.current;
    if (!el || !current) return;
    setDuration(el.duration);
    setLoop({ a: null, b: null });
    try {
      const saved = Number(localStorage.getItem(RESUME_PREFIX + resumeKey(current)));
      setResumeAt(saved && shouldResume(saved, el.duration) ? saved : null);
    } catch { setResumeAt(null); }
  };

  const onTimeUpdate = () => {
    const el = audioRef.current;
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

  // Autoplay the next track once its source is swapped in.
  const wasPlaying = useRef(false);
  useEffect(() => { wasPlaying.current = playing; }, [playing]);
  useEffect(() => {
    if (current && wasPlaying.current) void play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Lock-screen / headphone controls.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: tags.title || current.name,
        artist: tags.artist || '',
        album: tags.album || '',
        artwork: art ? [{ src: art }] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => void play());
      navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => pl.goPrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => { pl.goNext(); });
    } catch { /* unsupported */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, tags, art]);

  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed, current]);

  const seekTo = (v: number) => { const el = audioRef.current; if (el) { el.currentTime = v; setTime(v); } };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {pl.items.length === 0 ? (
        <Dropzone onDrop={(files) => pl.add(files)} accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" multiple>
          <div className="space-y-1">
            <p className="flex items-center justify-center gap-2 text-lg font-bold"><Music className="h-5 w-5" /> {t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      ) : (
        <div className="space-y-4">
          {/* Now playing */}
          <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-muted p-4 sm:flex-row sm:items-center">
            <div className="mx-auto flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden border-2 border-border bg-background">
              {art
                ? <img src={art} alt="" className="h-full w-full object-cover" />
                : <Disc3 className="h-12 w-12 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="min-w-0">
                <p className="truncate text-lg font-black">{tags.title || current?.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {[tags.artist, tags.album, tags.year].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>

              <canvas ref={canvasRef} width={480} height={48} className="h-12 w-full rounded bg-background" />

              <input
                type="range" min={0} max={duration || 0} step={0.1} value={time}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="w-full accent-accent"
                aria-label="seek"
              />
              <div className="flex justify-between font-mono text-xs text-muted-foreground">
                <span>{formatTime(time)}</span><span>{formatTime(duration)}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => pl.goPrev()} aria-label="previous"><SkipBack className="h-4 w-4" /></Button>
                <Button onClick={() => (playing ? audioRef.current?.pause() : void play())} aria-label={playing ? 'pause' : 'play'}>
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="secondary" onClick={() => { pl.goNext(); }} aria-label="next"><SkipForward className="h-4 w-4" /></Button>
                <Button variant={pl.shuffle ? 'primary' : 'secondary'} onClick={() => pl.setShuffle(!pl.shuffle)} aria-label="shuffle"><Shuffle className="h-4 w-4" /></Button>
                <Button
                  variant={pl.repeat === 'off' ? 'secondary' : 'primary'}
                  onClick={() => pl.setRepeat(pl.repeat === 'off' ? 'all' : pl.repeat === 'all' ? 'one' : 'off')}
                  aria-label="repeat"
                >
                  {pl.repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t.speed}</span>
                  <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent">
                    {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
                  </select>
                </label>
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">{t.loopAB}</span>
                  <Button variant="secondary" onClick={() => setLoop((l) => ({ ...l, a: time }))}>{t.setA}</Button>
                  <Button variant="secondary" onClick={() => setLoop((l) => ({ ...l, b: time }))}>{t.setB}</Button>
                  {(loop.a !== null || loop.b !== null) && (
                    <Button variant="ghost" onClick={() => setLoop({ a: null, b: null })}>{t.clearLoop}</Button>
                  )}
                </span>
                {loop.a !== null && loop.b !== null && (
                  <span className="font-mono text-xs text-accent">{formatTime(loop.a)} → {formatTime(loop.b)}</span>
                )}
              </div>
            </div>
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

          {/* Playlist */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t.playlist} ({pl.items.length})</span>
              <Button variant="ghost" size="sm" onClick={pl.clear}>{t.clear}</Button>
            </div>
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {pl.items.map((item, i) => (
                <li key={item.id} className={`flex items-center gap-2 px-3 py-2 text-sm ${i === pl.index ? 'bg-accent/10' : 'bg-muted/40'}`}>
                  <button type="button" onClick={() => pl.setIndex(i)} className="min-w-0 flex-1 truncate text-left">
                    {i === pl.index && <Music className="mr-1 inline h-3.5 w-3.5 text-accent" />}
                    {item.name}
                  </button>
                  <button type="button" onClick={() => pl.removeAt(i)} aria-label="remove" className="text-muted-foreground hover:text-red-600"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <Dropzone onDrop={(files) => pl.add(files)} accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" multiple>
              <p className="text-sm text-muted-foreground">{t.drop}</p>
            </Dropzone>
          </div>
        </div>
      )}

      {pl.rejected.length > 0 && (
        <Alert variant="error">
          {t.unsupported} {pl.rejected.join(', ')} — <a href="/tools/audio-convert" className="underline">{t.convert}</a>
        </Alert>
      )}

      <audio
        ref={audioRef}
        src={current?.url}
        onLoadedMetadata={onLoaded}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
