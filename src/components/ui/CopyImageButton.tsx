import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { clipboardService } from '@/services/clipboard.service';
import { Button } from './Button';

interface CopyImageButtonProps {
  /** The image to copy, or a function that produces it on demand. */
  blob: Blob | (() => Blob | Promise<Blob>) | null;
  disabled?: boolean;
}

/** Copies an image to the clipboard, with brief "Copied" / error feedback. */
export function CopyImageButton({ blob, disabled }: CopyImageButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  if (!clipboardService.supported) return null;

  const handleCopy = async () => {
    if (!blob) return;
    try {
      // Pass the producer straight through — copyImage keeps write() synchronous
      // within this click so Safari preserves the user gesture.
      await clipboardService.copyImage(blob);
      setState('copied');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 1600);
  };

  return (
    <Button variant="secondary" onClick={handleCopy} disabled={disabled || !blob}>
      {state === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {state === 'copied' ? 'Copied' : state === 'error' ? 'Copy failed' : 'Copy image'}
    </Button>
  );
}
