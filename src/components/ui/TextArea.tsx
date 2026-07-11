import type { TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  monospace?: boolean;
}

export function TextArea({ label, monospace = true, className = '', ...props }: TextAreaProps) {
  return (
    <label className="block space-y-1.5">
      {label && (
        <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      )}
      <textarea
        spellCheck={false}
        className={`w-full min-h-[10rem] resize-y border-2 border-border bg-muted p-3 text-sm outline-none transition-shadow focus:shadow-brutal ${monospace ? 'font-mono' : ''} ${className}`}
        {...props}
      />
    </label>
  );
}
