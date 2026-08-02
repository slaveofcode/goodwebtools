import { useState } from 'react';
import type { Lang } from '@/i18n/config';
import { Button } from '@/components/ui/Button';
import { ImageResult } from '@/components/ui/ImageResult';
import CameraCapture from './CameraCapture';

const TR: Record<Lang, { openCamera: string; retake: string }> = {
  en: { openCamera: 'Open camera', retake: 'Retake' },
  id: { openCamera: 'Buka kamera', retake: 'Ambil ulang' },
};

export default function CameraTool({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [photo, setPhoto] = useState<File | null>(null);
  const [capturing, setCapturing] = useState(true);

  const retake = () => { setPhoto(null); setCapturing(true); };

  return (
    <div className="space-y-4">
      {capturing && (
        <CameraCapture
          lang={lang}
          onCapture={(file) => { setPhoto(file); setCapturing(false); }}
          onCancel={() => setCapturing(false)}
        />
      )}

      {!capturing && !photo && (
        <Button onClick={() => setCapturing(true)}>{t.openCamera}</Button>
      )}

      {photo && (
        <div className="space-y-2">
          {/* ImageResult already renders Download / Copy image / Edit in Annotator. */}
          <ImageResult blob={photo} filename={photo.name} />
          <Button variant="secondary" onClick={retake}>{t.retake}</Button>
        </div>
      )}
    </div>
  );
}
