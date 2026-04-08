import { motion } from 'framer-motion';
import { ArrowUpRight, CalendarDays, Clock3, Plus, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dashboardCopy } from '../../lib/constants';
import type { WorkspaceSummary } from '../../lib/types';
import { Card } from '../ui/Card';
import { buttonStyles } from '../ui/Button';
import { WorkspaceLayout } from './WorkspaceLayout';

interface DashboardShellProps {
  workspace: WorkspaceSummary;
  onSignOut: () => Promise<void>;
}

export function DashboardShell({ workspace, onSignOut }: DashboardShellProps) {
  const copy = dashboardCopy[workspace.crmType];
  const statValues = ['128', '24', '89%'];

  return (
    <WorkspaceLayout workspace={workspace} onSignOut={onSignOut}>
      <div className="space-y-6">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"
          >
            <Card className="overflow-hidden p-6">
              <div className="absolute inset-0 bg-hero-radial opacity-70" />
              <div className="relative">
                <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                  Dashboard shell
                </div>
                <h2 className="mt-5 font-display text-4xl font-semibold text-white">{copy.headline}</h2>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/records" className={buttonStyles('primary', 'sm')}>
                    Open records
                  </Link>
                  <Link to="/records" state={{ openCreateRecord: true }} className={buttonStyles('secondary', 'sm')}>
                    Create record
                  </Link>
                  <Link to="/imports" className={buttonStyles('ghost', 'sm')}>
                    Import leads
                  </Link>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {copy.statLabels.map((label, index) => (
                    <div key={label} className="rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
                      <div className="text-xs uppercase tracking-[0.28em] text-slate-500">{label}</div>
                      <div className="mt-4 flex items-end justify-between">
                        <div className="font-display text-3xl text-white">{statValues[index]}</div>
                        <div className="inline-flex items-center gap-1 text-sm text-emerald-300">
                          +12%
                          <ArrowUpRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Welcome block</p>
                  <h3 className="mt-2 font-display text-2xl text-white">Today&apos;s focus</h3>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  <Zap className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {copy.quickActions.map((action) => (
                  <button
                    key={action}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left text-sm text-slate-300 transition hover:border-cyan-300/30 hover:text-white"
                  >
                    <span>{action}</span>
                    <Plus className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </Card>
          </motion.section>

          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Recent activity</p>
                  <h3 className="mt-2 font-display text-2xl text-white">What moved in your workspace</h3>
                </div>
                <Clock3 className="h-5 w-5 text-slate-500" />
              </div>
              <div className="mt-6 space-y-4">
                {copy.activity.map((item, index) => (
                  <div
                    key={item}
                    className="flex items-start gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4"
                  >
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                      0{index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-white">{item}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        Placeholder activity feed tailored to the selected CRM type.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Widget area</p>
                    <h3 className="mt-2 font-display text-2xl text-white">Performance pulse</h3>
                  </div>
                  <CalendarDays className="h-5 w-5 text-slate-500" />
                </div>
                <div className="mt-6 grid h-56 grid-cols-8 items-end gap-3">
                  {[28, 46, 38, 72, 64, 92, 80, 104].map((height) => (
                    <div
                      key={height}
                      className="rounded-t-2xl bg-gradient-to-t from-[#4f7cff] via-[#34d7ff] to-white"
                      style={{ height }}
                    />
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Next build zone</p>
                <h3 className="mt-2 font-display text-2xl text-white">Placeholder widgets</h3>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {['Pipeline board', 'Communication stream', 'Tasks and reminders', 'Analytics widgets'].map(
                    (widget) => (
                      <div
                        key={widget}
                        className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm text-slate-400"
                      >
                        {widget}
                      </div>
                    ),
                  )}
                </div>
              </Card>
            </div>
          </section>
      </div>
    </WorkspaceLayout>
  );
}
