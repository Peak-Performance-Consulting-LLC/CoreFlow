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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-80 bg-[radial-gradient(circle_at_top_left,rgba(255,240,220,0.18),transparent_28%),linear-gradient(180deg,#B59670_0%,#9C7E58_18%,#866847_52%,#72583D_100%)] p-6 text-[#2F2418] lg:flex lg:flex-col">
      <div className="flex items-center justify-between rounded-[28px] bg-[linear-gradient(180deg,rgba(255,252,247,0.88)_0%,rgba(246,236,221,0.72)_100%)] p-4 shadow-[0_18px_38px_rgba(54,37,19,0.16)] backdrop-blur-sm">
        <LogoMark />
        <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(255,250,243,0.74)] text-[#5A4630] transition hover:bg-[#FFFDFC] hover:text-[#2F2418]">
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 rounded-[28px] bg-[linear-gradient(165deg,rgba(255,253,249,0.86)_0%,rgba(241,227,206,0.62)_100%)] p-5 shadow-[0_20px_40px_rgba(54,37,19,0.14)]">
        <div className="text-xs uppercase tracking-[0.32em] text-[#7A5C33]">Workspace</div>
        <div className="mt-2 font-display text-2xl text-[#1E1B18]">{workspace.name}</div>
        <div className="mt-2 text-sm text-[#5E5347]">{formatCrmLabel(workspace.crmType)} Mode</div>
      </div>

      <nav className="mt-6 flex-1 space-y-2 rounded-[30px] bg-[linear-gradient(180deg,rgba(87,63,39,0.18)_0%,rgba(66,46,28,0.16)_100%)] p-3">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                  isActive
                    ? 'bg-[linear-gradient(135deg,#FFFDFC_0%,#F4E7D7_100%)] text-[#1E1B18] shadow-[0_18px_32px_rgba(44,29,15,0.18)]'
                    : 'text-[rgba(255,247,236,0.92)] hover:bg-[rgba(255,250,243,0.14)] hover:text-[#FFFDFC]'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
