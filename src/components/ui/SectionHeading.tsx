import { cn } from '../../lib/utils';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'left' | 'center';
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
}: SectionHeadingProps) {
  return (
    <div className={cn('max-w-2xl space-y-4', align === 'center' ? 'mx-auto text-center' : '')}>
      <div className="inline-flex items-center rounded-full border border-accent-blue/25 bg-accent-blue/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-accent-blue">
        {eyebrow}
      </div>
      <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      <p className="text-base leading-8 text-slate-700">{description}</p>
    </div>
  );
}
