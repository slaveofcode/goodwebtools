import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './Button';

interface CopyButtonProps {
  value: string;
  label?: string;
  disabled?: boolean;
}

export function CopyButton({ value, label = 'Copy', disabled }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  return (
    <Button variant="secondary" onClick={handleCopy} disabled={disabled || !value}>
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
