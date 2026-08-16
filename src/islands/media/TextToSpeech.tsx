import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { splitIntoChunks } from '@/tools/media/tts.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; placeholder: string; voice: string; rate: string; pitch: string;
  speak: string; pause: string; resume: string; stop: string; unsupported: string; noVoices: string;
}> = {
  en: {
    intro: 'Turn text into natural speech with your browser’s built-in voices. Type or paste text, pick a voice, adjust speed and pitch, and press Speak. It runs entirely on your device — nothing is uploaded.',
    placeholder: 'Type or paste text to read aloud…',
    voice: 'Voice', rate: 'Speed', pitch: 'Pitch',
    speak: 'Speak', pause: 'Pause', resume: 'Resume', stop: 'Stop',
    unsupported: 'Your browser does not support speech synthesis. Try a recent Chrome, Edge or Safari.',
    noVoices: 'No voices found in this browser yet — try reloading the page.',
  },
  id: {
    intro: 'Ubah teks menjadi suara alami dengan voice bawaan browser Anda. Ketik atau tempel teks, pilih voice, atur kecepatan dan nada, lalu tekan Bacakan. Berjalan sepenuhnya di perangkat Anda — tidak ada yang diunggah.',
    placeholder: 'Ketik atau tempel teks untuk dibacakan…',
    voice: 'Voice', rate: 'Kecepatan', pitch: 'Nada',
    speak: 'Bacakan', pause: 'Jeda', resume: 'Lanjut', stop: 'Hentikan',
    unsupported: 'Browser Anda tidak mendukung sintesis suara. Coba Chrome, Edge, atau Safari terbaru.',
    noVoices: 'Belum ada voice ditemukan di browser ini — coba muat ulang halaman.',
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
    </div>
  );
}
