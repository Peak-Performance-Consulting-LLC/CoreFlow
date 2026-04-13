import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  rightElement?: ReactNode;
}

export function Input({ label, error, hint, rightElement, className, ...props }: InputProps) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <span
        className={cn(
          'relative flex h-12 items-center rounded-2xl border bg-[#FFFDFC] px-4 transition',
          error
            ? 'border-rose-400/60 focus-within:border-rose-300'
            : 'border-[#E7DED2] focus-within:border-accent-blue/45 focus-within:bg-[#FFFDFC]',
        )}
      >
        <input
          className={cn(
            'h-full w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-500',
            rightElement ? 'pr-10' : '',
            className,
          )}
          {...props}
        />
        {rightElement ? <span className="absolute right-4 text-slate-600">{rightElement}</span> : null}
      </span>
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
