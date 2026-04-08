import { cn } from '../../lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-glow">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4f7cff]/80 via-[#34d7ff]/50 to-[#8b5cf6]/80" />
        <div className="absolute inset-[1px] rounded-[15px] bg-slate-950/80" />
        <div className="relative h-5 w-5 rounded-full bg-gradient-to-br from-cyan-300 to-blue-400 shadow-[0_0_24px_rgba(52,215,255,0.4)]" />
      </div>
      <div>
        <div className="font-display text-lg font-semibold tracking-wide text-white">CoreFlow</div>
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Shared CRM Platform</div>
      </div>
    </div>
  );
}
