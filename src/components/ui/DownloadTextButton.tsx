import { Download } from 'lucide-react';
import { downloadService } from '@/services/download';
import { Button } from './Button';

interface DownloadTextButtonProps {
  text: string;
  filename: string;
  mime?: string;
  label?: string;
}

/** Download a string as a file (client-side, via the shared download service). */
export function DownloadTextButton({ text, filename, mime = 'text/plain;charset=utf-8', label = 'Download' }: DownloadTextButtonProps) {
  const onClick = () => downloadService.download(new Blob([text], { type: mime }), filename);
  return (
    <Button variant="secondary" onClick={onClick} disabled={!text}>
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
