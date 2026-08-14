import { useState } from 'react';
import { decodeQrFromFile } from '@/tools/image/qr-decode.lib';
import { Dropzone } from '@/components/ui/Dropzone';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import { usePasteImage } from '@/hooks/usePasteImage';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  noQrFound: string;
  cannotRead: string;
  dropPrompt: string;
  decodedLocally: string;
  decodedContent: string;
}> = {
  en: {
    noQrFound: 'No QR code found in this image.',
    cannotRead: 'Could not read the image file.',
    dropPrompt: 'Drop a QR image or click to browse',
    decodedLocally: 'Decoded entirely in your browser · or paste (⌘V)',
    decodedContent: 'Decoded content',
  },
  id: {
    noQrFound: 'Tidak ada kode QR yang ditemukan pada gambar ini.',
    cannotRead: 'Tidak dapat membaca file gambar.',
    dropPrompt: 'Letakkan gambar QR atau klik untuk menelusuri',
    decodedLocally: 'Didekode sepenuhnya di browser Anda · atau tempel (⌘V)',
    decodedContent: 'Konten hasil dekode',
  },
};

export default function QrRead({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleFile = async (files: File[]) => {
    setError('');
    setValue('');
    if (files.length === 0) return;
    try {
      const decoded = await decodeQrFromFile(files[0]);
      if (decoded) {
        setValue(decoded);
      } else {
        setError(t.noQrFound);
      }
    } catch {
      setError(t.cannotRead);
    }
  };

  usePasteImage(file => handleFile([file]));

  const isUrl = /^https?:\/\//i.test(value);

  return (
    <div className="space-y-4">
      <Dropzone onDrop={handleFile} accept="image/*" multiple={false}>
        <div className="space-y-2">
          <p className="text-lg">{t.dropPrompt}</p>
          <p className="text-sm text-muted-foreground">{t.decodedLocally}</p>
        </div>
      </Dropzone>

      {error && <Alert variant="error">{error}</Alert>}

      {value && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{t.decodedContent}</span>
            <CopyButton value={value} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm break-all">
            {isUrl ? (
              <a href={value} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                {value}
              </a>
            ) : (
              <code>{value}</code>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
