import { ArrowDownToLine, LayoutGrid, PanelLeftClose, PhoneCall, Rows3, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { formatCrmLabel } from '../../lib/utils';
import type { WorkspaceSummary } from '../../lib/types';
import { LogoMark } from '../ui/LogoMark';

export function DashboardSidebar({ workspace }: { workspace: WorkspaceSummary }) {
  const { user } = useAuth();
  const isOwner = workspace.ownerId === user?.id;
  const navItems = [
    { label: 'Overview', icon: LayoutGrid, to: `/dashboard/${workspace.crmType}` },
    { label: 'Records', icon: Rows3, to: '/records' },
    { label: 'Imports', icon: ArrowDownToLine, to: '/imports' },
    { label: 'Voice Ops', icon: PhoneCall, to: '/voice' },
    ...(isOwner ? [{ label: 'Voice Settings', icon: Settings, to: '/settings/voice' }] : []),
  ];

  return (
    <aside className="hidden w-80 shrink-0 border-r border-white/10 bg-slate-950/75 p-5 lg:flex lg:flex-col">
      <div className="flex items-center justify-between rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
        <LogoMark />
        <button className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400">
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 rounded-[26px] border border-cyan-300/20 bg-cyan-300/10 p-4">
        <div className="text-xs uppercase tracking-[0.28em] text-cyan-200">Workspace</div>
        <div className="mt-2 font-display text-2xl text-white">{workspace.name}</div>
        <div className="mt-2 text-sm text-cyan-100/80">{formatCrmLabel(workspace.crmType)} Mode</div>
      </div>

      <nav className="mt-6 flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                  isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
        CoreFlow is ready for the next module layer. This shell is built to grow into pipelines, automation, and analytics.
      </div>
    </aside>
  );
}
