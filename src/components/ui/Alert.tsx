import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface AlertProps {
  variant: 'error' | 'success';
  children: React.ReactNode;
}

export function Alert({ variant, children }: AlertProps) {
  const isError = variant === 'error';
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
        isError
          ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
          : 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
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
