import { Download } from 'lucide-react';
import { downloadService } from '@/services/download.service';
import { Button } from './Button';

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

  return (
    <Button onClick={handleDownload} disabled={disabled || !blob}>
      <Download className="h-4 w-4" />
      Download {filename}
    </Button>
  );
}
