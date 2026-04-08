import { motion } from 'framer-motion';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonStyles } from '../ui/Button';
import { Card } from '../ui/Card';

const floatingCards = [
  { title: 'Workspace Created', value: 'Northline HQ', position: 'left-0 top-8' },
  { title: 'CRM Mode', value: 'Restaurant', position: 'right-4 top-20' },
  { title: 'Automation Ready', value: 'Edge Functions + Auth', position: 'left-10 bottom-10' },
];

export function HeroSection() {
  return (
    <section id="hero" className="section-shell relative pt-16 sm:pt-20 lg:pt-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 space-y-8"
        >
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
            One shared CRM platform for modern operators
          </div>
          <div className="space-y-6">
            <h1 className="max-w-3xl font-display text-5xl font-semibold tracking-tight text-white sm:text-6xl xl:text-7xl">
              Run every industry mode from one premium platform with <span className="text-gradient">CoreFlow</span>.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              Launch with a beautiful onboarding experience, create a workspace, choose your CRM mode,
              and drop directly into a polished dashboard built for growth.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/signup" className={buttonStyles('primary', 'lg')}>
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className={buttonStyles('secondary', 'lg')}>
              <PlayCircle className="h-4 w-4" />
              Watch Demo
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['5 launch modes', 'Real Estate to Auto Repair'],
              ['Auth + workspace flow', 'Supabase powered onboarding'],
              ['Dashboard-ready shell', 'Personalized by CRM selection'],
            ].map(([value, label]) => (
              <div key={value} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="font-display text-2xl font-semibold text-white">{value}</div>
                <div className="mt-1 text-sm text-slate-400">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-cyan-400/10 to-violet-500/20 blur-3xl" />
          <Card className="overflow-hidden p-4 sm:p-6">
            <div className="absolute inset-0 bg-hero-radial opacity-80" />
            <div className="absolute inset-0 grid-overlay opacity-20" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Dashboard entry</p>
                  <p className="mt-1 font-display text-xl font-semibold text-white">CoreFlow Workspace</p>
                </div>
                <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  Real Estate
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[26px] border border-white/10 bg-slate-950/70 p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Today</p>
                      <h3 className="mt-2 font-display text-2xl text-white">Welcome back, team</h3>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4f7cff]/30 to-[#34d7ff]/20 text-cyan-200">
                      92%
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ['128', 'New leads'],
                      ['17', 'Deals moving'],
                      ['$2.4M', 'Pipeline value'],
                    ].map(([value, label]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="font-display text-2xl text-white">{value}</div>
                        <p className="mt-1 text-sm text-slate-400">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex h-40 items-end gap-3 rounded-[26px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4">
                    {[42, 68, 55, 90, 74, 106, 88].map((height, index) => (
                      <motion.div
                        key={height}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height, opacity: 1 }}
                        transition={{ delay: 0.4 + index * 0.06 }}
                        className="flex-1 rounded-t-2xl bg-gradient-to-t from-[#4f7cff] via-[#34d7ff] to-white"
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {['Quick actions', 'Recent activity', 'Workspace health'].map((item, index) => (
                    <div
                      key={item}
                      className="rounded-[26px] border border-white/10 bg-slate-950/70 p-5"
                    >
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Panel {index + 1}</p>
                      <h4 className="mt-3 font-display text-xl text-white">{item}</h4>
                      <p className="mt-2 text-sm leading-7 text-slate-400">
                        Beautiful shell blocks ready for your future CRM workflows and automations.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {floatingCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, delay: index * 0.8 }}
              className={`absolute ${card.position} hidden rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-3 shadow-panel backdrop-blur-lg xl:block`}
            >
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{card.title}</div>
              <div className="mt-1 font-semibold text-white">{card.value}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
