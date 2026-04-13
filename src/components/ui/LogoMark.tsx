import { cn } from '../../lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-[#D8CCBD] bg-[#F7F4EE] shadow-glow">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D8B57E] via-[#B9925A] to-[#7A5C33]" />
        <div className="absolute inset-[1px] rounded-[15px] bg-[#FFFDFC]" />
        <div className="relative h-5 w-5 rounded-full bg-gradient-to-br from-[#C6A56B] to-[#7A5C33] shadow-[0_8px_18px_rgba(122,92,51,0.22)]" />
      </div>
      <div>
        <div className="font-display text-lg font-semibold tracking-wide text-slate-900">CoreFlow</div>
        <div className="text-xs uppercase tracking-[0.28em] text-slate-600">Shared CRM Platform</div>
      </div>
    </div>
  );
}
