import { cn } from '../../lib/utils';

export function AnimatedBackground({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-0 grid-overlay opacity-35" />
      <div className="absolute left-[-8%] top-16 h-64 w-64 rounded-full bg-blue-300/18 blur-[120px]" />
      <div className="absolute right-[-4%] top-[18%] h-72 w-72 rounded-full bg-cyan-300/16 blur-[140px]" />
      <div className="absolute bottom-[-10%] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-300/10 blur-[150px]" />
    </div>
  );
}
