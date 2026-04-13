import { LoaderCircle } from 'lucide-react';
import { LogoMark } from './LogoMark';

export function FullPageLoader({ label = 'Loading CoreFlow...' }: { label?: string }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 bg-hero-radial opacity-90" />
      <div className="surface-panel relative flex w-full max-w-md flex-col items-center gap-6 px-8 py-10 text-center">
        <LogoMark />
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-slate-900">Preparing your workspace</h1>
          <p className="text-sm leading-7 text-slate-600">{label}</p>
        </div>
      </div>
    </div>
  );
}
