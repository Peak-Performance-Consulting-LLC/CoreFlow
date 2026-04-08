import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonStyles } from '../ui/Button';

export function FinalCtaSection() {
  return (
    <section className="section-shell py-28">
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/70 px-6 py-12 shadow-panel sm:px-10 lg:px-14">
        <div className="absolute inset-0 bg-hero-radial opacity-90" />
        <div className="absolute inset-0 grid-overlay opacity-20" />
        <div className="relative max-w-3xl space-y-6">
          <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
            Ready to launch
          </div>
          <h2 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Turn the first version of CoreFlow into a product people want to use.
          </h2>
          <p className="text-lg leading-8 text-slate-300">
            The landing experience, auth flow, workspace onboarding, CRM mode selection, and dashboard shell are all ready for the next phase.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/signup" className={buttonStyles('primary', 'lg')}>
              Create your workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/signin" className={buttonStyles('secondary', 'lg')}>
              Sign into CoreFlow
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
