import { Download } from 'lucide-react';
import { downloadService } from '@/services/download';
import { Button } from './Button';
import { CopyImageButton } from './CopyImageButton';
import { EditInAnnotatorButton } from './EditInAnnotatorButton';

export interface ResultActionsProps {
  blob: Blob | null;
  filename: string;
  disabled?: boolean;
}

export function ResultActions({ blob, filename, disabled }: ResultActionsProps) {
  const handleDownload = async () => {
    if (!blob) return;
    await downloadService.download(blob, filename);
  };

  const isImage = !!blob && blob.type.startsWith('image/');

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={handleDownload} disabled={disabled || !blob}>
        <Download className="h-4 w-4" />
        Download {filename}
      </Button>
      {isImage && <CopyImageButton blob={blob} disabled={disabled} />}
      {isImage && <EditInAnnotatorButton blob={blob} filename={filename} disabled={disabled} />}
    </div>
  );
}
