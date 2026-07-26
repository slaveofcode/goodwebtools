import { useRef } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from './Button';

interface LoadFileButtonProps {
  /** Called with the file's text contents and its name. */
  onLoad: (text: string, fileName: string) => void;
  /** `accept` attribute for the file picker (e.g. '.json,application/json'). */
  accept?: string;
  label?: string;
}

/** A small button that reads a text file from disk and hands back its contents. */
export function LoadFileButton({ onLoad, accept, label = 'Load file' }: LoadFileButtonProps) {
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-loading the same file
    if (!file) return;
    onLoad(await file.text(), file.name);
  };

  return (
    <>
      <Button variant="secondary" onClick={() => ref.current?.click()}>
        <FileUp className="h-4 w-4" />
        {label}
      </Button>
      <input ref={ref} type="file" accept={accept} onChange={handle} className="hidden" />
    </>
  );
}

/** Lowercased file extension without the dot, e.g. "report.JSON" → "json". */
export function fileExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}
