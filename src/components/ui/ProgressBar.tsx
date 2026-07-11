export interface ProgressBarProps {
  percent: number;
  label?: string;
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm mb-2">
          <span>{label}</span>
          <span>{clampedPercent.toFixed(0)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${clampedPercent}%` }} />
      </div>
    </div>
  );
}
