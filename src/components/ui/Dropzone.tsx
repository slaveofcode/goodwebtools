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
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/50'}`}
    >
      <input type="file" id="file-input" accept={accept} multiple={multiple} onChange={handleFileInput} className="hidden" />
      <label htmlFor="file-input" className="cursor-pointer">
        {children || <p>Drop files here or click to browse</p>}
      </label>
    </div>
  );
}
