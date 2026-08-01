import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Upload } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useWakeLock } from '@/hooks/useWakeLock';
import { decodeToMono16k } from '@/tools/media/stt-audio.lib';
import { transcribeInWorker } from '@/tools/media/stt.client';
import { saveRecording, loadRecording } from '@/tools/media/recording-store';
import { type SttModelId } from '@/tools/media/stt.engine';
import {
  segmentsToText,
  segmentsToSrt,
  segmentsToVtt,
  formatClock,
  type TranscriptSegment,
} from '@/tools/media/stt.lib';

const MODELS: { value: SttModelId; label: string; note: string; multilingual?: boolean }[] = [
  { value: 'onnx-community/whisper-tiny.en', label: 'English · Fast', note: 'smallest download' },
  { value: 'onnx-community/whisper-base.en', label: 'English · Accurate', note: 'larger, more accurate' },
  { value: 'onnx-community/whisper-base', label: 'Multilingual', note: 'auto-detects language', multilingual: true },
  { value: 'onnx-community/whisper-small', label: 'Multilingual · Better', note: 'much better for non-English (e.g. Bahasa); larger download', multilingual: true },
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
  { value: 'russian', label: 'Russian' },
  { value: 'turkish', label: 'Turkish' },
];

type Tab = 'text' | 'timestamped' | 'subtitles';

export default function VoiceToText() {
  const recorder = useAudioRecorder();
  const wakeLock = useWakeLock();
  const [restored, setRestored] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [model, setModel] = useState<SttModelId>('onnx-community/whisper-tiny.en');
  const [language, setLanguage] = useState('');
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
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

  const setAudio = (blob: Blob, persist = true) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setAudioUrl(url);
    setAudioBlob(blob);
    setSegments(null);
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
      const isMultilingual = MODELS.find(m => m.value === model)?.multilingual;
      const segs = await transcribeInWorker(
        audio,
        model,
        isMultilingual ? language || undefined : undefined,
        r => setModelProgress(r),
      );
      setModelProgress(null); // model ready (or cached) — now inference (indeterminate)
      setSegments(segs);
      setEditedText(segmentsToText(segs));
      setTab('text');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription failed');
    } finally {
      setTranscribing(false);
      setModelProgress(null);
      wakeLock.release();
    }
  };

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

  const busy = transcribing;

  return (
    <div className="space-y-4">
      {/* Input: record or upload */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={toggleRecord} disabled={busy}>
          {recorder.recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {recorder.recording ? `Stop (${formatClock(recorder.seconds)})` : 'Record'}
        </Button>
        <span className="text-sm text-muted-foreground">or</span>
      </div>

      <Dropzone onDrop={onDrop} accept="audio/*,video/*" multiple={false}>
        <div className="space-y-1">
          <p className="flex items-center justify-center gap-2 text-lg font-bold">
            <Upload className="h-5 w-5" /> Drop an audio or video file
          </p>
          <p className="text-sm text-muted-foreground">mp3, wav, m4a, mp4… · transcribed on your device</p>
        </div>
      </Dropzone>

      {recorder.error && <Alert variant="error">{recorder.error.message}</Alert>}

      {audioUrl && (
        <div className="space-y-1">
          <audio ref={audioRef} controls src={audioUrl} onLoadedMetadata={fixAudioDuration} className="w-full" />
          {restored && <p className="text-xs text-muted-foreground">Restored your last recording.</p>}
        </div>
      )}

      {/* Model + run */}
      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Model</span>
        <div className="flex flex-wrap gap-2">
          {MODELS.map(m => (
            <Button
              key={m.value}
              variant={model === m.value ? 'primary' : 'secondary'}
              aria-pressed={model === m.value}
              onClick={() => setModel(m.value)}
              disabled={busy}
              title={m.note}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      {MODELS.find(m => m.value === model)?.multilingual && (
        <label className="block space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Language</span>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            disabled={busy}
            className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <span className="block text-xs text-muted-foreground">Pick the spoken language for best accuracy — auto-detect often mis-guesses shorter clips.</span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={transcribe} disabled={!audioBlob || busy}>
          {busy ? 'Transcribing…' : 'Transcribe'}
        </Button>
        {!audioBlob && !busy && (
          <span className="text-sm text-muted-foreground">
            {recorder.recording ? 'Press Stop to finish the recording first.' : 'Record or drop a file to enable this.'}
          </span>
        )}
      </div>

      {modelProgress !== null && (
        <ProgressBar percent={modelProgress * 100} label="Downloading model (first time only)" />
      )}
      {busy && modelProgress === null && (
        <p className="text-sm text-muted-foreground">
          Transcribing on your device… ({formatClock(elapsed)})
          {MODELS.find(m => m.value === model)?.value === 'onnx-community/whisper-small'
            ? ' — the “Better” model is much slower, especially on phones; a short clip can take a few minutes.'
            : ' this can take a moment.'}
        </p>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {/* Output */}
      {segments && (
        <div className="space-y-3 border-2 border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={tab === 'text' ? 'primary' : 'secondary'} onClick={() => setTab('text')}>Text</Button>
            <Button variant={tab === 'timestamped' ? 'primary' : 'secondary'} onClick={() => setTab('timestamped')}>Timestamped</Button>
            <Button variant={tab === 'subtitles' ? 'primary' : 'secondary'} onClick={() => setTab('subtitles')}>Subtitles</Button>
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
            <Button variant="secondary" onClick={() => download('txt')}>Download .txt</Button>
            <Button variant="secondary" onClick={() => download('srt')}>Download .srt</Button>
            <Button variant="secondary" onClick={() => download('vtt')}>Download .vtt</Button>
          </div>
        </div>
      )}
    </div>
  );
}
