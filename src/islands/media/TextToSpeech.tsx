import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { splitIntoChunks } from '@/tools/media/tts.lib';
import { floatToWav } from '@/tools/media/tts-audio.lib';
import { NEURAL_VOICES } from '@/tools/media/neural-tts.engine';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; placeholder: string; voice: string; rate: string; pitch: string;
  speak: string; pause: string; resume: string; stop: string; unsupported: string; noVoices: string;
  dlHeading: string; dlIntro: string; nVoice: string; pauseLen: string; pauseHint: string;
  generate: string; loading: string; synth: string; dlWav: string; dlMp3: string; encoding: string; nErr: string;
}> = {
  en: {
    intro: 'Turn text into natural speech with your browser’s built-in voices. Type or paste text, pick a voice, adjust speed and pitch, and press Speak. It runs entirely on your device — nothing is uploaded.',
    placeholder: 'Type or paste text to read aloud… (type [pause] for a short silence)',
    voice: 'Voice', rate: 'Speed', pitch: 'Pitch',
    speak: 'Speak', pause: 'Pause', resume: 'Resume', stop: 'Stop',
    unsupported: 'Your browser does not support speech synthesis. Try a recent Chrome, Edge or Safari.',
    noVoices: 'No voices found in this browser yet — try reloading the page.',
    dlHeading: 'Download as audio (on-device AI voice)',
    dlIntro: 'The browser voices above can’t be saved to a file, so this uses an on-device AI voice to generate downloadable audio. The voice model downloads once (~30–60 MB) and is cached for offline use; add [pause] in your text for a silence.',
    nVoice: 'AI voice language', pauseLen: 'Pause length', pauseHint: 'Silence inserted at each [pause] and blank line.',
    generate: 'Generate audio', loading: 'Downloading voice model…', synth: 'Generating audio…',
    dlWav: 'Download WAV', dlMp3: 'Download MP3', encoding: 'Encoding MP3…',
    nErr: 'Could not generate audio. Try again or a different language.',
  },
  id: {
    intro: 'Ubah teks menjadi suara alami dengan voice bawaan browser Anda. Ketik atau tempel teks, pilih voice, atur kecepatan dan nada, lalu tekan Bacakan. Berjalan sepenuhnya di perangkat Anda — tidak ada yang diunggah.',
    placeholder: 'Ketik atau tempel teks untuk dibacakan… (ketik [pause] untuk jeda singkat)',
    voice: 'Voice', rate: 'Kecepatan', pitch: 'Nada',
    speak: 'Bacakan', pause: 'Jeda', resume: 'Lanjut', stop: 'Hentikan',
    unsupported: 'Browser Anda tidak mendukung sintesis suara. Coba Chrome, Edge, atau Safari terbaru.',
    noVoices: 'Belum ada voice ditemukan di browser ini — coba muat ulang halaman.',
    dlHeading: 'Unduh sebagai audio (voice AI di perangkat)',
    dlIntro: 'Voice browser di atas tidak bisa disimpan ke berkas, jadi ini memakai voice AI di perangkat untuk menghasilkan audio yang bisa diunduh. Model voice diunduh sekali (~30–60 MB) dan disimpan untuk pemakaian offline; tambahkan [pause] di teks untuk jeda.',
    nVoice: 'Bahasa voice AI', pauseLen: 'Panjang jeda', pauseHint: 'Keheningan disisipkan di tiap [pause] dan baris kosong.',
    generate: 'Buat audio', loading: 'Mengunduh model voice…', synth: 'Menghasilkan audio…',
    dlWav: 'Unduh WAV', dlMp3: 'Unduh MP3', encoding: 'Meng-encode MP3…',
    nErr: 'Tidak dapat membuat audio. Coba lagi atau pilih bahasa lain.',
  },
};

export default function TextToSpeech({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [supported, setSupported] = useState(true);
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const doneRef = useRef(0);

  // Neural (downloadable) TTS state.
  const [nVoiceId, setNVoiceId] = useState(lang === 'id' ? 'ind' : 'eng');
  const [pauseSec, setPauseSec] = useState(0.4);
  const [nBusy, setNBusy] = useState(false);
  const [nStatus, setNStatus] = useState('');
  const [nProgress, setNProgress] = useState(0);
  const [nError, setNError] = useState('');
  const [wavUrl, setWavUrl] = useState('');
  const audioRef = useRef<{ audio: Float32Array; sampleRate: number } | null>(null);
  const wavBytesRef = useRef<Uint8Array | null>(null);

  useEffect(() => () => { if (wavUrl) URL.revokeObjectURL(wavUrl); }, [wavUrl]);

  const generate = async () => {
    const src = text.trim();
    if (!src) return;
    setNBusy(true); setNError(''); setNProgress(0); setNStatus(t.loading);
    setWavUrl(prev => { if (prev) URL.revokeObjectURL(prev); return ''; });
    try {
      const { synthesizeNeural } = await import('@/tools/media/neural-tts.engine');
      const voice = NEURAL_VOICES.find(v => v.id === nVoiceId) ?? NEURAL_VOICES[0];
      const res = await synthesizeNeural(src, voice, pauseSec, r => {
        setNProgress(Math.round(r * 100));
        if (r >= 1) setNStatus(t.synth);
      });
      audioRef.current = res;
      const wav = floatToWav(res.audio, res.sampleRate);
      wavBytesRef.current = wav;
      setWavUrl(URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })));
    } catch (e) {
      setNError(e instanceof Error && e.message ? e.message : t.nErr);
    } finally {
      setNBusy(false); setNStatus('');
    }
  };

  const saveBlob = (bytes: Uint8Array, type: string, name: string) => {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadWav = () => { if (wavBytesRef.current) saveBlob(wavBytesRef.current, 'audio/wav', 'speech.wav'); };
  const downloadMp3 = async () => {
    if (!audioRef.current) return;
    setNBusy(true); setNStatus(t.encoding);
    try {
      const { encodeMp3 } = await import('@/tools/media/neural-tts.engine');
      saveBlob(await encodeMp3(audioRef.current.audio, audioRef.current.sampleRate), 'audio/mpeg', 'speech.mp3');
    } finally {
      setNBusy(false); setNStatus('');
    }
  };

  const neuralSection = (
    <div className="space-y-3 border-t-2 border-border pt-4">
      <div>
        <h2 className="text-sm font-black uppercase tracking-wide">{t.dlHeading}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t.dlIntro}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">{t.nVoice}</span>
          <select value={nVoiceId} onChange={e => setNVoiceId(e.target.value)} disabled={nBusy}
            className="w-full border-2 border-border bg-background p-2 text-sm">
            {NEURAL_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">{t.pauseLen}: {pauseSec.toFixed(1)}s</span>
          <input type="range" min={0} max={1.5} step={0.1} value={pauseSec} onChange={e => setPauseSec(Number(e.target.value))} className="w-full accent-accent" />
          <span className="text-xs text-muted-foreground">{t.pauseHint}</span>
        </label>
      </div>
      <Button onClick={generate} disabled={nBusy || !text.trim()}>{nBusy ? (nStatus || t.synth) : t.generate}</Button>
      {nBusy && nProgress > 0 && nProgress < 100 && (
        <div className="h-2 w-full overflow-hidden border-2 border-border">
          <div className="h-full bg-accent transition-all" style={{ width: `${nProgress}%` }} />
        </div>
      )}
      {nError && <Alert variant="error">{nError}</Alert>}
      {wavUrl && !nBusy && (
        <div className="space-y-2">
          <audio controls src={wavUrl} className="w-full" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={downloadWav}>{t.dlWav}</Button>
            <Button variant="secondary" onClick={downloadMp3}>{t.dlMp3}</Button>
          </div>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
      return;
    }
    const synth = window.speechSynthesis;
    const load = () => {
      const list = synth.getVoices();
      if (list.length) {
        setVoices(list);
        setVoiceURI(prev => {
          if (prev && list.some(v => v.voiceURI === prev)) return prev;
          const want = lang === 'id' ? 'id' : 'en';
          const match = list.find(v => v.lang.toLowerCase().startsWith(want)) ?? list[0];
          return match.voiceURI;
        });
      }
    };
    load();
    synth.addEventListener('voiceschanged', load);
    return () => {
      synth.removeEventListener('voiceschanged', load);
      synth.cancel();
    };
  }, [lang]);

  const speak = useCallback(() => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const chunks = splitIntoChunks(text);
    if (!chunks.length) return;
    const voice = voices.find(v => v.voiceURI === voiceURI) ?? null;
    doneRef.current = 0;
    chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c);
      if (voice) u.voice = voice;
      u.rate = rate;
      u.pitch = pitch;
      if (i === 0) u.onstart = () => { setSpeaking(true); setPaused(false); };
      u.onend = () => {
        doneRef.current += 1;
        if (doneRef.current >= chunks.length) { setSpeaking(false); setPaused(false); }
      };
      u.onerror = () => { setSpeaking(false); setPaused(false); };
      synth.speak(u);
    });
  }, [text, voices, voiceURI, rate, pitch]);

  const pause = () => { window.speechSynthesis.pause(); setPaused(true); };
  const resume = () => { window.speechSynthesis.resume(); setPaused(false); };
  const stop = () => { window.speechSynthesis.cancel(); setSpeaking(false); setPaused(false); };

  if (!supported) {
    // OS voices unavailable, but the neural download voice still works.
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.intro}</p>
        <Alert variant="error">{t.unsupported}</Alert>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder={t.placeholder}
          className="w-full resize-y border-2 border-border bg-muted p-3 text-sm" />
        {neuralSection}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={6}
        placeholder={t.placeholder}
        className="w-full resize-y border-2 border-border bg-muted p-3 text-sm"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm sm:col-span-3">
          <span className="block font-semibold">{t.voice}</span>
          <select value={voiceURI} onChange={e => setVoiceURI(e.target.value)}
            className="w-full border-2 border-border bg-background p-2 text-sm">
            {voices.length === 0 && <option>{t.noVoices}</option>}
            {voices.map(v => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">{t.rate}: {rate.toFixed(1)}×</span>
          <input type="range" min={0.5} max={2} step={0.1} value={rate}
            onChange={e => setRate(Number(e.target.value))} className="w-full accent-accent" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">{t.pitch}: {pitch.toFixed(1)}</span>
          <input type="range" min={0} max={2} step={0.1} value={pitch}
            onChange={e => setPitch(Number(e.target.value))} className="w-full accent-accent" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={speak} disabled={!text.trim()}>{t.speak}</Button>
        {speaking && !paused && <Button variant="secondary" onClick={pause}>{t.pause}</Button>}
        {speaking && paused && <Button variant="secondary" onClick={resume}>{t.resume}</Button>}
        {speaking && <Button variant="ghost" onClick={stop}>{t.stop}</Button>}
      </div>

      {neuralSection}
    </div>
  );
}
