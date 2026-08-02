import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './Button';
import { useUi } from '@/i18n/shared';

interface CopyButtonProps {
  value: string;
  label?: string;
  disabled?: boolean;
}

export function CopyButton({ value, label, disabled }: CopyButtonProps) {
  const ui = useUi();
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
      {copied ? ui.copied : (label ?? ui.copy)}
    </Button>
  );
}
