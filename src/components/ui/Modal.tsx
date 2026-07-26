import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** A centered modal dialog with a backdrop; closes on Escape, backdrop, or X. */
export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md border-2 border-border bg-background shadow-brutal"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-border px-4 py-3">
          <h2 className="text-lg font-bold uppercase tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
