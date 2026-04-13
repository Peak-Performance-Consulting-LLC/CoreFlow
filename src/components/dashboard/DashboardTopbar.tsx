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
    <div className="flex flex-col gap-4 border-b border-[#E7DED2] px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <div className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-[#E7DED2] bg-[#F7F4EE] text-sm font-semibold text-slate-900 sm:flex">
          {getInitials(workspace.name)}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Active workspace</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-slate-900">{workspace.name}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] px-4 py-3 text-sm text-slate-600">
          <Search className="h-4 w-4" />
          Search contacts, tasks, or notes
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-[#D8CCBD] bg-[#F6EFE4] px-4 py-3 text-sm font-medium text-[#7A5C33]">
          <Sparkles className="h-4 w-4" />
          {formatCrmLabel(workspace.crmType)}
        </div>
        <button className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] text-slate-700 transition hover:text-slate-900">
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
