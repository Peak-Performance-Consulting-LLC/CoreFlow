import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { crmOptions } from '../../lib/constants';
import { AnimatedBackground } from '../ui/AnimatedBackground';
import { LogoMark } from '../ui/LogoMark';

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ eyebrow, title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground />
      <div className="section-shell relative flex min-h-screen items-center py-10">
        <div className="grid w-full gap-8 xl:grid-cols-[0.95fr_1.05fr]">
          <motion.aside
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-8 shadow-panel backdrop-blur-xl xl:flex xl:flex-col xl:justify-between"
          >
            <div className="space-y-10">
              <LogoMark />
              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                  Shared onboarding flow
                </div>
                <h2 className="font-display text-4xl font-semibold leading-tight text-white">
                  Premium entry into a multi-industry CRM platform.
                </h2>
                <p className="max-w-xl text-base leading-8 text-slate-300">
                  Sign in or create your account, launch your workspace, and route into the dashboard that matches your selected CRM mode.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {crmOptions.slice(0, 4).map((option) => {
                const Icon = option.icon;

                return (
                  <div key={option.value} className="rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-cyan-200">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="mt-4 font-display text-lg text-white">{option.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{option.description}</p>
                  </div>
                );
              })}
            </div>
          </motion.aside>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="surface-panel relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10"
          >
            <div className="absolute inset-0 bg-hero-radial opacity-70" />
            <div className="relative space-y-8">
              <div className="xl:hidden">
                <LogoMark />
              </div>
              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
                  {eyebrow}
                </div>
                <div>
                  <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    {title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-8 text-slate-400">{description}</p>
                </div>
              </div>
              {children}
              <div className="border-t border-white/10 pt-6 text-sm text-slate-400">{footer}</div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
