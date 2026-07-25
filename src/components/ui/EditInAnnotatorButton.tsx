import { PenTool } from 'lucide-react';
import { sendImageToAnnotator } from '@/services/handoff';
import { Button } from './Button';

interface EditInAnnotatorButtonProps {
  /** The image to hand off, or a function that produces it on demand. */
  blob: Blob | (() => Blob | Promise<Blob>) | null;
  filename?: string;
  disabled?: boolean;
}

/** Opens the Image Annotator pre-loaded with this image (via IndexedDB handoff). */
export function EditInAnnotatorButton({ blob, filename = 'image.png', disabled }: EditInAnnotatorButtonProps) {
  const handleClick = async () => {
    if (!blob) return;
    const resolved = typeof blob === 'function' ? await blob() : blob;
    await sendImageToAnnotator(resolved, filename);
  };

  return (
    <Button variant="secondary" onClick={handleClick} disabled={disabled || !blob}>
      <PenTool className="h-4 w-4" />
      Edit in Annotator
    </Button>
  );
}
