import { LogoMark } from '../ui/LogoMark';

export function HomeFooter() {
  return (
    <footer className="border-t border-[#E7DED2] py-10">
      <div className="section-shell flex flex-col gap-6 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <LogoMark />
        <div className="flex flex-wrap gap-4">
          <a href="#features" className="transition hover:text-slate-900">
            Features
          </a>
          <a href="#modes" className="transition hover:text-slate-900">
            Modes
          </a>
          <a href="#how-it-works" className="transition hover:text-slate-900">
            How It Works
          </a>
        </div>
        <div>CoreFlow. Shared CRM infrastructure for multi-industry teams.</div>
      </div>
    </footer>
  );
}
