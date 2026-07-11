import type { TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  monospace?: boolean;
}

export function TextArea({ label, monospace = true, className = '', ...props }: TextAreaProps) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-muted-foreground">{label}</span>}
      <textarea
        spellCheck={false}
        className={`w-full min-h-[10rem] resize-y rounded-lg border border-border bg-muted/40 p-3 text-sm outline-none transition-colors focus:border-accent ${monospace ? 'font-mono' : ''} ${className}`}
        {...props}
      />
    </label>
  );
}
