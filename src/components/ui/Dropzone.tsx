import { useCallback, useState } from 'react';

export interface DropzoneProps {
  onDrop: (files: File[]) => void | Promise<void>;
  accept?: string;
  multiple?: boolean;
  children?: React.ReactNode;
}

export function Dropzone({ onDrop, accept, multiple = true, children }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await onDrop(files);
  }, [onDrop]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    await onDrop(files);
  }, [onDrop]);

  return (
    // The whole area is a <label>, so clicking anywhere opens the file picker.
    <label
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`block cursor-pointer border-[3px] border-dashed p-8 text-center transition-all ${isDragging ? 'border-accent bg-accent/10 shadow-brutal' : 'border-border hover:shadow-brutal'}`}
    >
      <input type="file" id="file-input" accept={accept} multiple={multiple} onChange={handleFileInput} className="hidden" />
      {children || <p>Drop files here or click to browse</p>}
    </label>
  );
}
