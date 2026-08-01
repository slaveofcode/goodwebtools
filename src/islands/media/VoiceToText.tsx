import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Upload } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { decodeToMono16k } from '@/tools/media/stt-audio.lib';
import { createTranscriber, type SttModelId } from '@/tools/media/stt.engine';
import {
  segmentsToText,
  segmentsToSrt,
  segmentsToVtt,
  formatClock,
  type TranscriptSegment,
} from '@/tools/media/stt.lib';

const MODELS: { value: SttModelId; label: string; note: string }[] = [
  { value: 'onnx-community/whisper-tiny.en', label: 'English · Fast', note: 'smallest download' },
  { value: 'onnx-community/whisper-base.en', label: 'English · Accurate', note: 'larger, more accurate' },
  { value: 'onnx-community/whisper-base', label: 'Multilingual', note: 'auto-detects language' },
];

type Tab = 'text' | 'timestamped' | 'subtitles';

export default function VoiceToText() {
  const recorder = useAudioRecorder();
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [model, setModel] = useState<SttModelId>('onnx-community/whisper-tiny.en');
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
  const [editedText, setEditedText] = useState('');
  const [tab, setTab] = useState<Tab>('text');
  const [subFormat, setSubFormat] = useState<'srt' | 'vtt'>('srt');
  const [error, setError] = useState('');
  const urlRef = useRef('');

  // Pick up a finished recording as the working audio.
  useEffect(() => {
    if (recorder.blob) setAudio(recorder.blob);
  }, [recorder.blob]);

  // Revoke the preview URL on unmount.
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const setAudio = (blob: Blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setAudioUrl(url);
    setAudioBlob(blob);
    setSegments(null);
    setError('');
  };

  const onDrop = (files: File[]) => {
    const f = files.find(x => x.type.startsWith('audio/') || x.type.startsWith('video/'));
    if (f) setAudio(f);
  };

  const toggleRecord = () => {
    if (recorder.recording) {
      recorder.stop();
    } else {
      setSegments(null);
      setError('');
      recorder.start();
    }
  };

  const transcribe = async () => {
    if (!audioBlob) return;
    setError('');
    setSegments(null);
    setTranscribing(true);
    setModelProgress(0);
    try {
      const audio = await decodeToMono16k(audioBlob);
      const engine = await createTranscriber(model, r => setModelProgress(r));
      setModelProgress(null); // model ready — now inference (indeterminate)
      const segs = await engine.transcribe(audio);
      setSegments(segs);
      setEditedText(segmentsToText(segs));
      setTab('text');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription failed');
    } finally {
      setTranscribing(false);
      setModelProgress(null);
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
        <audio controls src={audioUrl} className="w-full" />
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
        <p className="text-sm text-muted-foreground">Transcribing on your device… this can take a moment.</p>
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
