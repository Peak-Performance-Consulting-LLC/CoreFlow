import { Bell, LogOut, Search, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import type { WorkspaceSummary } from '../../lib/types';
import { formatCrmLabel, getInitials } from '../../lib/utils';

interface DashboardTopbarProps {
  workspace: WorkspaceSummary;
  onSignOut: () => Promise<void>;
}

export function DashboardTopbar({ workspace, onSignOut }: DashboardTopbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <div className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sm font-semibold text-white sm:flex">
          {getInitials(workspace.name)}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Active workspace</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-white">{workspace.name}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          Search contacts, tasks, or notes
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-200">
          <Sparkles className="h-4 w-4" />
          {formatCrmLabel(workspace.crmType)}
        </div>
        <button className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:text-white">
          <Bell className="h-4 w-4" />
        </button>
        <Button variant="secondary" onClick={() => void onSignOut()}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
