import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import { readMediaInfo, mediaInfoRows, formatMediaInfo, mediaInfoJson, type MediaInfo as Info } from '@/tools/media/media-info.lib';
import { MediaInputError } from '@/tools/media/run-media.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; drop: string; reading: string; unsupported: string; failed: string; copyText: string; copyJson: string; labels: Record<string, string> }> = {
  en: {
    intro: 'See what’s inside a video or audio file — container, length, bitrate, codecs, resolution, frame rate, rotation, sample rate, channels, tags and cover art. The file is read in your browser; nothing is uploaded.',
    drop: 'Drop a video or audio file, or click to choose',
    reading: 'Reading the file…',
    unsupported: 'This file’s format can’t be read here (try MP4, MOV, WebM, MKV, MP3, M4A, WAV, FLAC, Ogg or TS).',
    failed: 'Could not read this file.',
    copyText: 'Copy as text', copyJson: 'Copy as JSON',
    labels: {},
  },
  id: {
    intro: 'Lihat isi file video atau audio — container, durasi, bitrate, codec, resolusi, frame rate, rotasi, sample rate, channel, tag, dan sampul. File dibaca di browser Anda; tidak ada yang diunggah.',
    drop: 'Letakkan file video atau audio, atau klik untuk memilih',
    reading: 'Membaca file…',
    unsupported: 'Format file ini tidak bisa dibaca di sini (coba MP4, MOV, WebM, MKV, MP3, M4A, WAV, FLAC, Ogg, atau TS).',
    failed: 'File ini tidak bisa dibaca.',
    copyText: 'Salin sebagai teks', copyJson: 'Salin sebagai JSON',
    labels: {
      General: 'Umum', File: 'File', Size: 'Ukuran', Container: 'Container', Type: 'Tipe', Duration: 'Durasi', 'Overall bitrate': 'Bitrate total',
      Codec: 'Codec', Resolution: 'Resolusi', 'Displayed as': 'Ditampilkan', Rotation: 'Rotasi', 'Frame rate': 'Frame rate', 'Sample rate': 'Sample rate',
      Channels: 'Channel', Bitrate: 'Bitrate', Language: 'Bahasa', Tags: 'Tag', Title: 'Judul', Artist: 'Artis', Album: 'Album', Year: 'Tahun', Cover: 'Sampul',
      Video: 'Video', Audio: 'Audio', Subtitle: 'Subtitle', Other: 'Lainnya', track: 'trek',
    },
  },
};

export default function MediaInfo({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const L = (s: string) => t.labels[s] ?? s;
  // "Video track 1" → "Video trek 1"
  const title = (s: string) => s.split(' ').map(L).join(' ');
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cover, setCover] = useState('');
  const run = useRef(0);

  useEffect(() => () => { if (cover) URL.revokeObjectURL(cover); }, [cover]);

  const onDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const id = ++run.current;
    setBusy(true); setError(''); setInfo(null); setCover('');
    try {
      const i = await readMediaInfo(file);
      if (id !== run.current) return;
      setInfo(i);
      if (i.tags.picture) setCover(URL.createObjectURL(new Blob([i.tags.picture.data as BlobPart], { type: i.tags.picture.mime })));
    } catch (e) {
      if (id === run.current) setError(e instanceof MediaInputError ? t.unsupported : t.failed);
    } finally {
      if (id === run.current) setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <Dropzone onDrop={onDrop} multiple={false} accept="video/*,audio/*,.mkv,.ts,.mts,.m4a,.flac,.opus,.oga">
        <p className="text-sm font-bold">{t.drop}</p>
      </Dropzone>
      {busy && <p className="text-sm text-muted-foreground">{t.reading}</p>}
      {error && <Alert variant="error">{error}</Alert>}
      {info && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <CopyButton value={formatMediaInfo(info)} label={t.copyText} />
            <CopyButton value={mediaInfoJson(info)} label={t.copyJson} />
          </div>
          {cover && <img src={cover} alt="" className="h-32 w-32 border-2 border-border object-cover" />}
          {mediaInfoRows(info).map(section => (
            <section key={section.title} className="border-2 border-border">
              <h2 className="border-b-2 border-border bg-muted px-3 py-1.5 text-xs font-black uppercase tracking-wide">{title(section.title)}</h2>
              <table className="w-full text-sm">
                <tbody>
                  {section.rows.map(([k, v]) => (
                    <tr key={k} className="border-b border-border last:border-0">
                      <th scope="row" className="w-40 px-3 py-1.5 text-left font-bold text-muted-foreground">{L(k)}</th>
                      <td className="break-all px-3 py-1.5 font-mono">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
