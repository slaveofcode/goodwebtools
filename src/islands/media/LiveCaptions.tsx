import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { appendFinal } from '@/tools/media/captions.lib';
import type { Lang } from '@/i18n/config';

interface RecognitionResult { isFinal: boolean; 0: { transcript: string }; }
interface RecognitionEvent { resultIndex: number; results: { length: number;[i: number]: RecognitionResult }; }
interface RecognitionLike {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const LANGS = [
  { id: 'en-US', label: 'English (US)' }, { id: 'en-GB', label: 'English (UK)' },
  { id: 'id-ID', label: 'Bahasa Indonesia' }, { id: 'es-ES', label: 'Español' },
  { id: 'fr-FR', label: 'Français' }, { id: 'de-DE', label: 'Deutsch' },
  { id: 'ja-JP', label: '日本語' }, { id: 'zh-CN', label: '中文' },
];

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Large, live captions of what’s spoken — put a laptop on the table so someone hard-of-hearing can follow along.',
    privacy: 'Privacy note: unlike our other tools, this uses your browser’s built-in speech recognition. In Chrome and Edge that sends microphone audio to the browser’s speech service (e.g. Google) to transcribe. Don’t use it for sensitive conversations.',
    unsupported: 'Your browser does not support live speech recognition. Try Chrome or Edge on desktop.',
    language: 'Language', start: 'Start captions', stop: 'Stop', clear: 'Clear',
    listening: 'Listening…', denied: 'Microphone permission was denied.',
  },
  id: {
    intro: 'Teks langsung berukuran besar dari yang diucapkan — letakkan laptop di meja agar penyandang gangguan pendengaran bisa mengikuti.',
    privacy: 'Catatan privasi: berbeda dari tool kami lainnya, ini memakai pengenalan suara bawaan browser. Di Chrome dan Edge, audio mikrofon dikirim ke layanan suara browser (mis. Google) untuk ditranskripsi. Jangan gunakan untuk percakapan sensitif.',
    unsupported: 'Browser Anda tidak mendukung pengenalan suara langsung. Coba Chrome atau Edge di desktop.',
    language: 'Bahasa', start: 'Mulai teks', stop: 'Berhenti', clear: 'Bersihkan',
    listening: 'Mendengarkan…', denied: 'Izin mikrofon ditolak.',
  },
};

export default function LiveCaptions({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [supported, setSupported] = useState(true);
  const [running, setRunning] = useState(false);
  const [language, setLanguage] = useState(lang === 'id' ? 'id-ID' : 'en-US');
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef<RecognitionLike | null>(null);

  useEffect(() => {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike });
    if (!Ctor.SpeechRecognition && !Ctor.webkitSpeechRecognition) setSupported(false);
    return () => { recRef.current?.stop(); };
  }, []);

  const start = () => {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike });
    const Impl = Ctor.SpeechRecognition || Ctor.webkitSpeechRecognition;
    if (!Impl) { setSupported(false); return; }
    const rec = new Impl();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language;
    rec.onresult = (e) => {
      let interimChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) setFinalText(prev => appendFinal(prev, r[0].transcript));
        else interimChunk += r[0].transcript;
      }
      setInterim(interimChunk);
    };
    rec.onerror = (ev) => { if (ev.error === 'not-allowed') setError(t.denied); };
    rec.onend = () => { if (recRef.current) recRef.current.start(); }; // keep going until stopped
    recRef.current = rec;
    setError('');
    try { rec.start(); setRunning(true); } catch { /* already started */ }
  };

  const stop = () => {
    const rec = recRef.current;
    recRef.current = null;
    rec?.stop();
    setRunning(false);
    setInterim('');
  };

  const clear = () => { setFinalText(''); setInterim(''); };

  if (!supported) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.intro}</p>
        <Alert variant="error">{t.unsupported}</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="border-2 border-border bg-yellow-300 p-3 text-sm font-medium text-black shadow-brutal-sm">
        ⚠️ {t.privacy}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">{t.language}</span>
          <select value={language} onChange={e => setLanguage(e.target.value)} disabled={running}
            className="border-2 border-border bg-background p-2 text-sm">
            {LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        {!running ? <Button onClick={start}>{t.start}</Button> : <Button variant="secondary" onClick={stop}>{t.stop}</Button>}
        <Button variant="ghost" onClick={clear}>{t.clear}</Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="min-h-[40vh] rounded border-2 border-border bg-black p-6 text-3xl font-bold leading-snug text-white sm:text-4xl">
        {finalText} <span className="text-gray-400">{interim}</span>
        {running && !finalText && !interim && <span className="text-gray-500">{t.listening}</span>}
      </div>
    </div>
  );
}
