import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Radio, Square, Upload } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useLiveDictation } from '@/hooks/useLiveDictation';
import { useWakeLock } from '@/hooks/useWakeLock';
import { decodeToMono16k } from '@/tools/media/stt-audio.lib';
import { transcribeInWorker } from '@/tools/media/stt.client';
import { saveRecording, loadRecording } from '@/tools/media/recording-store';
import { type SttModelId } from '@/tools/media/stt.engine';
import { resolveModel, defaultLanguageFor, isWhistleLanguage, wordsToSegments } from '@/tools/media/whistle.lib';
import { WHISTLE_CACHE } from '@/tools/media/whistle.engine';
import {
  segmentsToText,
  segmentsToSrt,
  segmentsToVtt,
  formatClock,
  type TranscriptSegment,
} from '@/tools/media/stt.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  models: Record<string, { label: string; note: string }>;
  languages: Record<string, string>;
  stop: (clock: string) => string; record: string; or: string;
  dropTitle: string; dropDesc: string; restored: string;
  model: string; language: string; languageHint: string;
  transcribing: string; transcribe: string;
  pressStop: string; recordOrDrop: string;
  loadingCache: string; downloading: string;
  onDevice: (clock: string) => string; slowSmall: string; takesMoment: string;
  errTranscribe: string;
  text: string; timestamped: string; subtitles: string;
  downloadTxt: string; downloadSrt: string; downloadVtt: string;
  switched: (language: string) => string; fastReset: string;
  live: string; liveHint: string; liveFastOnly: string; listening: string; liveStop: (clock: string) => string;
  liveStarting: string; liveDenied: string; liveUnsupported: string; liveFailed: string;
}> = {
  en: {
    models: {
      whistle: { label: 'Fast · 7 languages', note: '17 MB, quick on phones — English, German, French, Spanish, Italian, Dutch, Polish' },
      'onnx-community/whisper-base': { label: 'Multilingual', note: 'auto-detects language; use for Bahasa and other languages' },
      'onnx-community/whisper-small': { label: 'Multilingual · Better', note: 'much better for non-English (e.g. Bahasa); larger download' },
    },
    languages: {
      '': 'Auto-detect', indonesian: 'Indonesian (Bahasa)', malay: 'Malay', javanese: 'Javanese',
      sundanese: 'Sundanese', english: 'English', chinese: 'Chinese', japanese: 'Japanese',
      korean: 'Korean', arabic: 'Arabic', hindi: 'Hindi', tagalog: 'Tagalog', thai: 'Thai',
      vietnamese: 'Vietnamese', spanish: 'Spanish', portuguese: 'Portuguese', french: 'French',
      german: 'German', italian: 'Italian', dutch: 'Dutch', polish: 'Polish', russian: 'Russian', turkish: 'Turkish',
    },
    stop: c => `Stop (${c})`, record: 'Record', or: 'or',
    dropTitle: 'Drop an audio or video file',
    dropDesc: 'mp3, wav, m4a, mp4… · transcribed on your device',
    restored: 'Restored your last recording.',
    model: 'Model', language: 'Language',
    languageHint: 'Pick the spoken language for best accuracy — auto-detect often mis-guesses shorter clips.',
    transcribing: 'Transcribing…', transcribe: 'Transcribe',
    pressStop: 'Press Stop to finish the recording first.',
    recordOrDrop: 'Record or drop a file to enable this.',
    loadingCache: 'Loading model from cache…', downloading: 'Downloading model (first time only)…',
    onDevice: c => `Transcribing on your device… (${c})`,
    slowSmall: ' — the “Better” model is much slower, especially on phones; a short clip can take a few minutes.',
    takesMoment: ' this can take a moment.',
    errTranscribe: 'Transcription failed',
    text: 'Text', timestamped: 'Timestamped', subtitles: 'Subtitles',
    downloadTxt: 'Download .txt', downloadSrt: 'Download .srt', downloadVtt: 'Download .vtt',
    switched: l => `Fast doesn’t support ${l} — switched to Multilingual.`,
    fastReset: 'Fast handles English, German, French, Spanish, Italian, Dutch and Polish — language reset to Auto-detect.',
    live: 'Live dictation',
    liveHint: 'See words appear as you speak (Fast model).',
    liveFastOnly: 'Live dictation needs the Fast model and one of its languages.',
    listening: 'Listening…',
    liveStop: c => `Stop live (${c})`,
    liveStarting: 'Starting live dictation…',
    liveDenied: 'Microphone access was blocked — allow it in your browser settings, or upload a file instead.',
    liveUnsupported: 'This browser can’t do live dictation — record or upload instead.',
    liveFailed: 'Live dictation stopped',
  },
  id: {
    models: {
      whistle: { label: 'Cepat · 7 bahasa', note: '17 MB, cepat di ponsel — Inggris, Jerman, Prancis, Spanyol, Italia, Belanda, Polandia' },
      'onnx-community/whisper-base': { label: 'Multibahasa', note: 'mendeteksi bahasa otomatis; gunakan untuk Bahasa Indonesia dan bahasa lain' },
      'onnx-community/whisper-small': { label: 'Multibahasa · Lebih Baik', note: 'jauh lebih baik untuk non-Inggris (mis. Bahasa Indonesia); unduhan lebih besar' },
    },
    languages: {
      '': 'Deteksi otomatis', indonesian: 'Indonesia (Bahasa)', malay: 'Melayu', javanese: 'Jawa',
      sundanese: 'Sunda', english: 'Inggris', chinese: 'Mandarin', japanese: 'Jepang',
      korean: 'Korea', arabic: 'Arab', hindi: 'Hindi', tagalog: 'Tagalog', thai: 'Thai',
      vietnamese: 'Vietnam', spanish: 'Spanyol', portuguese: 'Portugis', french: 'Prancis',
      german: 'Jerman', italian: 'Italia', dutch: 'Belanda', polish: 'Polandia', russian: 'Rusia', turkish: 'Turki',
    },
    stop: c => `Berhenti (${c})`, record: 'Rekam', or: 'atau',
    dropTitle: 'Letakkan berkas audio atau video',
    dropDesc: 'mp3, wav, m4a, mp4… · ditranskripsi di perangkat Anda',
    restored: 'Rekaman terakhir Anda dipulihkan.',
    model: 'Model', language: 'Bahasa',
    languageHint: 'Pilih bahasa yang diucapkan untuk akurasi terbaik — deteksi otomatis sering salah menebak klip yang pendek.',
    transcribing: 'Mentranskripsi…', transcribe: 'Transkripsi',
    pressStop: 'Tekan Berhenti untuk menyelesaikan rekaman dulu.',
    recordOrDrop: 'Rekam atau letakkan berkas untuk mengaktifkan ini.',
    loadingCache: 'Memuat model dari cache…', downloading: 'Mengunduh model (hanya pertama kali)…',
    onDevice: c => `Mentranskripsi di perangkat Anda… (${c})`,
    slowSmall: ' — model “Lebih Baik” jauh lebih lambat, terutama di ponsel; klip pendek bisa memakan beberapa menit.',
    takesMoment: ' ini bisa memakan waktu sejenak.',
    errTranscribe: 'Transkripsi gagal',
    text: 'Teks', timestamped: 'Berstempel waktu', subtitles: 'Subtitel',
    downloadTxt: 'Unduh .txt', downloadSrt: 'Unduh .srt', downloadVtt: 'Unduh .vtt',
    switched: l => `Model Cepat tidak mendukung ${l} — dialihkan ke Multibahasa.`,
    fastReset: 'Model Cepat mendukung Inggris, Jerman, Prancis, Spanyol, Italia, Belanda, dan Polandia — bahasa diatur ke Deteksi otomatis.',
    live: 'Dikte langsung',
    liveHint: 'Lihat kata muncul saat Anda berbicara (model Cepat).',
    liveFastOnly: 'Dikte langsung membutuhkan model Cepat dan salah satu bahasanya.',
    listening: 'Mendengarkan…',
    liveStop: c => `Hentikan dikte (${c})`,
    liveStarting: 'Memulai dikte langsung…',
    liveDenied: 'Akses mikrofon diblokir — izinkan di pengaturan browser, atau unggah berkas.',
    liveUnsupported: 'Browser ini tidak mendukung dikte langsung — rekam atau unggah berkas saja.',
    liveFailed: 'Dikte langsung berhenti',
  },
};

const MODELS: { value: SttModelId; label: string; note: string }[] = [
  { value: 'whistle', label: 'Fast · 7 languages', note: '17 MB, quick on phones' },
  { value: 'onnx-community/whisper-base', label: 'Multilingual', note: 'auto-detects language' },
  { value: 'onnx-community/whisper-small', label: 'Multilingual · Better', note: 'much better for non-English (e.g. Bahasa); larger download' },
];

// Whisper source-language options (value = the lowercase name Whisper expects).
// Empty value = auto-detect. Region-relevant languages first.
const LANGUAGES: { value: string; label: string }[] = [
  { value: '', label: 'Auto-detect' },
  { value: 'indonesian', label: 'Indonesian (Bahasa)' },
  { value: 'malay', label: 'Malay' },
  { value: 'javanese', label: 'Javanese' },
  { value: 'sundanese', label: 'Sundanese' },
  { value: 'english', label: 'English' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'arabic', label: 'Arabic' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'tagalog', label: 'Tagalog' },
  { value: 'thai', label: 'Thai' },
  { value: 'vietnamese', label: 'Vietnamese' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'italian', label: 'Italian' },
  { value: 'dutch', label: 'Dutch' },
  { value: 'polish', label: 'Polish' },
  { value: 'russian', label: 'Russian' },
  { value: 'turkish', label: 'Turkish' },
];

type Tab = 'text' | 'timestamped' | 'subtitles';

export default function VoiceToText({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const recorder = useAudioRecorder();
  const dictation = useLiveDictation();
  const wakeLock = useWakeLock();
  const [restored, setRestored] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  // Default: the Fast engine, unless the locale's language needs Whisper (Indonesian pages).
  const [language, setLanguage] = useState(() => defaultLanguageFor(lang));
  const [model, setModel] = useState<SttModelId>(() => resolveModel('whistle', defaultLanguageFor(lang)).model);
  const [note, setNote] = useState('');
  const [liveMode, setLiveMode] = useState(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [modelCached, setModelCached] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
  const [editedText, setEditedText] = useState('');
  const [tab, setTab] = useState<Tab>('text');
  const [subFormat, setSubFormat] = useState<'srt' | 'vtt'>('srt');
  const [error, setError] = useState('');
  const urlRef = useRef('');
  const audioRef = useRef<HTMLAudioElement>(null);

  // Pick up a finished recording as the working audio.
  useEffect(() => {
    if (recorder.blob) setAudio(recorder.blob);
  }, [recorder.blob]);

  // Revoke the preview URL on unmount.
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  // Ask the browser to keep this origin's storage persistent, so the (potentially
  // large) cached Whisper model isn't evicted between sessions and re-downloaded.
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  // Tick an elapsed counter while transcribing (the worker keeps the UI responsive).
  useEffect(() => {
    if (!transcribing) return;
    setElapsed(0);
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [transcribing]);

  const setAudio = (blob: Blob, persist = true, keepTranscript = false) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setAudioUrl(url);
    setAudioBlob(blob);
    if (!keepTranscript) setSegments(null);
    setError('');
    if (persist) { setRestored(false); void saveRecording(blob); }
  };

  // Restore the last recording (survives a mobile tab discard / reload).
  useEffect(() => {
    let cancelled = false;
    loadRecording().then(blob => {
      if (!cancelled && blob) { setAudio(blob, false); setRestored(true); }
    });
    return () => { cancelled = true; };
  }, []);

  const onDrop = (files: File[]) => {
    const f = files.find(x => x.type.startsWith('audio/') || x.type.startsWith('video/'));
    if (f) setAudio(f);
  };

  // MediaRecorder blobs have no duration in their header, so the browser reports
  // duration=Infinity and treats the clip like a live stream — which freezes the
  // native pause/seek controls. Seek to the end once to force a real duration.
  const fixAudioDuration = () => {
    const el = audioRef.current;
    if (!el || el.duration !== Infinity) return;
    const onUpdate = () => { el.removeEventListener('timeupdate', onUpdate); el.currentTime = 0; };
    el.addEventListener('timeupdate', onUpdate);
    try { el.currentTime = 1e101; } catch { /* ignore */ }
  };

  const toggleRecord = () => {
    if (recorder.recording) {
      recorder.stop();
    } else {
      audioRef.current?.pause();
      setSegments(null);
      setError('');
      recorder.start();
    }
  };

  // Is the selected model already in the browser cache? (Definitive — the bar
  // shows even on a cache read, so this tells the user whether it's a real download.)
  const refreshModelCached = async () => {
    try {
      if (model === 'whistle') {
        const keys = await (await caches.open(WHISTLE_CACHE)).keys();
        setModelCached(keys.some(r => r.url.endsWith('whistle.cact')));
        return;
      }
      const cache = await caches.open('transformers-cache');
      const keys = await cache.keys();
      setModelCached(keys.some(r => r.url.includes(`${model}/resolve`)));
    } catch { setModelCached(false); }
  };
  useEffect(() => {
    void refreshModelCached();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  const transcribe = async () => {
    if (!audioBlob) return;
    audioRef.current?.pause(); // don't leave the preview playing while inference blocks the thread
    setError('');
    setSegments(null);
    setTranscribing(true);
    setModelProgress(null); // only shows once real download progress fires (first load)
    void wakeLock.request(); // keep the screen on so the phone doesn't lock + discard the tab
    try {
      const audio = await decodeToMono16k(audioBlob);
      const segs = await transcribeInWorker(
        audio,
        model,
        language || undefined,
        r => setModelProgress(r),
      );
      setModelProgress(null); // model ready (or cached) — now inference (indeterminate)
      void refreshModelCached(); // it's cached now
      setSegments(segs);
      setEditedText(segmentsToText(segs));
      setTab('text');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errTranscribe);
    } finally {
      setTranscribing(false);
      setModelProgress(null);
      wakeLock.release();
    }
  };

  // Language/model pairing: Fast only covers its 7 languages, so picking another
  // language switches to Whisper; picking Fast with such a language resets it.
  const chooseLanguage = (value: string) => {
    setLanguage(value);
    const r = resolveModel(model, value);
    if (r.switched) {
      setModel(r.model);
      setLiveMode(false);
      setNote(t.switched(t.languages[value] ?? value));
    } else setNote('');
  };
  const chooseModel = (value: SttModelId) => {
    setModel(value);
    if (value === 'whistle' && !isWhistleLanguage(language)) {
      setLanguage('');
      setNote(t.fastReset);
    } else setNote('');
    if (value !== 'whistle') setLiveMode(false);
  };

  // Live dictation: words stream in while recording; on stop they become the result.
  const toggleLive = async () => {
    if (dictation.live) {
      const words = await dictation.stop();
      const segs = wordsToSegments(words);
      setSegments(segs);
      setEditedText(segmentsToText(segs));
      setTab('text');
      wakeLock.release();
    } else {
      audioRef.current?.pause();
      setSegments(null);
      setError('');
      void wakeLock.request();
      await dictation.start(language || undefined);
    }
  };
  // Keep the live recording (replay / re-transcribe) without wiping its transcript.
  useEffect(() => {
    if (dictation.blob) setAudio(dictation.blob, true, true);
  }, [dictation.blob]);
  useEffect(() => {
    if (!dictation.error) return;
    const { reason, message } = dictation.error;
    setError(reason === 'denied' ? t.liveDenied : reason === 'unsupported' ? t.liveUnsupported : `${t.liveFailed}${message ? `: ${message}` : ''}`);
    wakeLock.release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictation.error]);

  const srt = useMemo(() => (segments ? segmentsToSrt(segments) : ''), [segments]);
  const vtt = useMemo(() => (segments ? segmentsToVtt(segments) : ''), [segments]);
  const currentSubs = subFormat === 'srt' ? srt : vtt;
  const timestamped = useMemo(
    () => (segments ? segments.map(s => `[${formatClock(s.start)}] ${s.text.trim()}`).join('\n') : ''),
    [segments],
  );

  const copyValue = tab === 'text' ? editedText : tab === 'timestamped' ? timestamped : currentSubs;

  const download = (kind: 'txt' | 'srt' | 'vtt') => {
    const map = { txt: [editedText, 'text/plain'], srt: [srt, 'text/plain'], vtt: [vtt, 'text/vtt'] } as const;
    const [content, mime] = map[kind];
    downloadService.download(new Blob([content], { type: mime }), `transcript.${kind}`);
  };

  const busy = transcribing || dictation.starting;
  const liveAvailable = model === 'whistle' && isWhistleLanguage(language);

  return (
    <div className="space-y-4">
      {/* Input: record or upload */}
      <div className="flex flex-wrap items-center gap-3">
        {liveMode && liveAvailable ? (
          <Button onClick={() => void toggleLive()} disabled={transcribing || dictation.starting || recorder.recording}>
            {dictation.live ? <Square className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
            {dictation.live ? t.liveStop(formatClock(dictation.seconds)) : dictation.starting ? t.liveStarting : t.live}
          </Button>
        ) : (
          <Button onClick={toggleRecord} disabled={busy || dictation.live}>
            {recorder.recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {recorder.recording ? t.stop(formatClock(recorder.seconds)) : t.record}
          </Button>
        )}
        <label className="flex items-center gap-2 text-sm" title={liveAvailable ? t.liveHint : t.liveFastOnly}>
          <input
            type="checkbox"
            checked={liveMode && liveAvailable}
            disabled={!liveAvailable || recorder.recording || dictation.live || busy}
            onChange={e => setLiveMode(e.target.checked)}
          />
          {t.live}
        </label>
        <span className="text-sm text-muted-foreground">{t.or}</span>
      </div>
      <p className="text-xs text-muted-foreground">{liveAvailable ? t.liveHint : t.liveFastOnly}</p>

      {dictation.progress !== null && (
        <ProgressBar percent={dictation.progress * 100} label={modelCached ? t.loadingCache : t.downloading} />
      )}
      {(dictation.live || dictation.words.length > 0 || dictation.pending) && !segments && (
        <div data-testid="live-transcript" aria-live="polite" className="min-h-[4rem] border-2 border-border bg-muted p-3 text-sm">
          {dictation.live && <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.listening}</span>}
          <span>{dictation.words.map(w => w.word).join(' ')}</span>
          {dictation.pending && <span className="text-muted-foreground"> {dictation.pending}</span>}
        </div>
      )}

      <Dropzone onDrop={onDrop} accept="audio/*,video/*" multiple={false}>
        <div className="space-y-1">
          <p className="flex items-center justify-center gap-2 text-lg font-bold">
            <Upload className="h-5 w-5" /> {t.dropTitle}
          </p>
          <p className="text-sm text-muted-foreground">{t.dropDesc}</p>
        </div>
      </Dropzone>

      {recorder.error && <Alert variant="error">{recorder.error.message}</Alert>}

      {audioUrl && (
        <div className="space-y-1">
          <audio ref={audioRef} controls src={audioUrl} onLoadedMetadata={fixAudioDuration} className="w-full" />
          {restored && <p className="text-xs text-muted-foreground">{t.restored}</p>}
        </div>
      )}

      {/* Model + run */}
      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.model}</span>
        <div className="flex flex-wrap gap-2">
          {MODELS.map(m => (
            <Button
              key={m.value}
              variant={model === m.value ? 'primary' : 'secondary'}
              aria-pressed={model === m.value}
              onClick={() => chooseModel(m.value)}
              disabled={busy}
              title={t.models[m.value]?.note ?? m.note}
            >
              {t.models[m.value]?.label ?? m.label}
            </Button>
          ))}
        </div>
      </div>

      <label className="block space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.language}</span>
          <select
            value={language}
            onChange={e => chooseLanguage(e.target.value)}
            disabled={busy || dictation.live}
            className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{t.languages[l.value] ?? l.label}</option>)}
          </select>
          <span className="block text-xs text-muted-foreground">{t.languageHint}</span>
          {note && <span role="status" className="block text-xs font-bold">{note}</span>}
        </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={transcribe} disabled={!audioBlob || busy || dictation.live}>
          {busy ? t.transcribing : t.transcribe}
        </Button>
        {!audioBlob && !busy && (
          <span className="text-sm text-muted-foreground">
            {recorder.recording ? t.pressStop : t.recordOrDrop}
          </span>
        )}
      </div>

      {modelProgress !== null && (
        <ProgressBar percent={modelProgress * 100} label={modelCached ? t.loadingCache : t.downloading} />
      )}
      {busy && modelProgress === null && (
        <p className="text-sm text-muted-foreground">
          {t.onDevice(formatClock(elapsed))}
          {MODELS.find(m => m.value === model)?.value === 'onnx-community/whisper-small'
            ? t.slowSmall
            : t.takesMoment}
        </p>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {/* Output */}
      {segments && (
        <div className="space-y-3 border-2 border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={tab === 'text' ? 'primary' : 'secondary'} onClick={() => setTab('text')}>{t.text}</Button>
            <Button variant={tab === 'timestamped' ? 'primary' : 'secondary'} onClick={() => setTab('timestamped')}>{t.timestamped}</Button>
            <Button variant={tab === 'subtitles' ? 'primary' : 'secondary'} onClick={() => setTab('subtitles')}>{t.subtitles}</Button>
            <div className="ml-auto">
              <CopyButton value={copyValue} />
            </div>
          </div>

          {tab === 'text' && (
            <textarea
              value={editedText}
              onChange={e => setEditedText(e.target.value)}
              rows={8}
              className="w-full resize-y border-2 border-border bg-muted p-3 text-sm outline-none focus:shadow-brutal-sm"
            />
          )}

          {tab === 'timestamped' && (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-2 border-border bg-muted p-3 text-sm">{timestamped}</pre>
          )}

          {tab === 'subtitles' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button variant={subFormat === 'srt' ? 'primary' : 'secondary'} onClick={() => setSubFormat('srt')}>SRT</Button>
                <Button variant={subFormat === 'vtt' ? 'primary' : 'secondary'} onClick={() => setSubFormat('vtt')}>VTT</Button>
              </div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-2 border-border bg-muted p-3 text-sm">{currentSubs}</pre>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => download('txt')}>{t.downloadTxt}</Button>
            <Button variant="secondary" onClick={() => download('srt')}>{t.downloadSrt}</Button>
            <Button variant="secondary" onClick={() => download('vtt')}>{t.downloadVtt}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
