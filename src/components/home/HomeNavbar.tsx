import { Menu, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonStyles } from '../ui/Button';
import { LogoMark } from '../ui/LogoMark';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Modes', href: '#modes' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Testimonials', href: '#testimonials' },
];

export function HomeNavbar() {
  return (
    <header className="section-shell sticky top-0 z-40 pt-6">
      <div className="glass-panel flex items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <LogoMark />
        <nav className="hidden items-center gap-6 text-sm text-slate-300 lg:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="transition hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          <Link to="/signin" className={buttonStyles('ghost', 'sm')}>
            Sign In
          </Link>
          <Link to="/signup" className={buttonStyles('primary', 'sm')}>
            Get Started
          </Link>
        </div>
        <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 flex justify-center sm:hidden">
        <a href="#hero" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
          <PlayCircle className="h-4 w-4" />
          Explore the launch preview
        </a>
      </div>
    </header>
  );
}
