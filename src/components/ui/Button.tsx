import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const variantClasses: Record<Variant, string> = {
  // Solid accent block with black outline + hard shadow, mechanical press.
  primary:
    'border-2 border-border bg-accent text-accent-foreground shadow-brutal press-brutal disabled:shadow-brutal',
  // White/surface block, same brutalist frame.
  secondary:
    'border-2 border-border bg-muted text-foreground shadow-brutal press-brutal disabled:shadow-brutal',
  // Flat, borderless — for tertiary actions like Clear.
  ghost: 'border-2 border-transparent text-foreground hover:border-border',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button className={`${base} ${variantClasses[variant]} ${className}`} {...props} />
  );
}
