import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface AlertProps {
  variant: 'error' | 'success';
  children: React.ReactNode;
}

export function Alert({ variant, children }: AlertProps) {
  const isError = variant === 'error';
  return (
    <div
      className={`flex items-start gap-2 border-2 border-border p-3 text-sm font-medium shadow-brutal-sm ${
        isError
          ? 'bg-red-400 text-black'
          : 'bg-green-400 text-black'
      }`}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="break-words">{children}</div>
    </div>
  );
}
