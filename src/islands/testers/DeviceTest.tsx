import { Mic, Webcam, Volume2, Keyboard, MousePointerClick, Monitor } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Lang } from '@/i18n/config';

interface Item { id: string; icon: LucideIcon; en: [string, string]; id_: [string, string] }

const ITEMS: Item[] = [
  { id: 'mic-test', icon: Mic, en: ['Microphone test', 'Waveform, level meter and a 3-second record + playback'], id_: ['Tes mikrofon', 'Waveform, meter level, dan rekam 3 detik + putar ulang'] },
  { id: 'webcam-test', icon: Webcam, en: ['Webcam test', 'Live preview, framing, mirror and resolution readout'], id_: ['Tes webcam', 'Pratinjau langsung, framing, cermin, dan info resolusi'] },
  { id: 'speaker-test', icon: Volume2, en: ['Speaker / headphone test', 'Left/right channel check, reference tones and a sweep'], id_: ['Tes speaker / headphone', 'Cek channel kiri/kanan, nada referensi, dan sapuan'] },
  { id: 'keyboard-test', icon: Keyboard, en: ['Keyboard test', 'Find a dead or stuck key on a visual layout'], id_: ['Tes keyboard', 'Temukan tombol mati atau macet pada tata letak visual'] },
  { id: 'mouse-test', icon: MousePointerClick, en: ['Mouse / click test', 'Buttons, scroll and double-click drift detection'], id_: ['Tes mouse / klik', 'Tombol, gulir, dan deteksi geser klik ganda'] },
  { id: 'screen-test', icon: Monitor, en: ['Dead pixel / screen test', 'Fullscreen solid-colour cycler for dead pixels'], id_: ['Tes piksel mati / layar', 'Pemutar warna solid layar penuh untuk piksel mati'] },
];

const TR: Record<Lang, { intro: string }> = {
  en: { intro: 'Run through a quick check of your microphone, camera, speakers, keyboard, mouse and screen before a call or after buying a device. Each test runs entirely in your browser — nothing is uploaded or recorded.' },
  id: { intro: 'Lakukan pengecekan cepat mikrofon, kamera, speaker, keyboard, mouse, dan layar sebelum panggilan atau setelah membeli perangkat. Setiap tes berjalan sepenuhnya di browser Anda — tidak ada yang diunggah atau direkam.' },
};

export default function DeviceTest({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const prefix = lang === 'id' ? '/id' : '';
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map(item => {
          const [title, desc] = lang === 'id' ? item.id_ : item.en;
          const Icon = item.icon;
          return (
            <a
              key={item.id}
              href={`${prefix}/tools/${item.id}`}
              className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 transition-colors hover:border-accent hover:bg-muted"
            >
              <Icon className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted-foreground">{desc}</span>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
