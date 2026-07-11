export interface ProgressBarProps {
  percent: number;
  label?: string;
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  return (
    <div className="w-full">
      {label && (
        <div className="mb-2 flex justify-between text-sm font-bold uppercase tracking-wide">
          <span>{label}</span>
          <span>{clampedPercent.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-4 w-full overflow-hidden border-2 border-border bg-muted">
        <div className="h-full bg-accent transition-all" style={{ width: `${clampedPercent}%` }} />
      </div>
    </div>
  );
}
