import { downloadService } from '@/services/download.service';

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
    <button
      onClick={handleDownload}
      disabled={disabled || !blob}
      className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
    >
      Download
    </button>
  );
}
