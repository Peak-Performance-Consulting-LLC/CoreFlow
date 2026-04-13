import type { ReactNode } from 'react';
import type { WorkspaceSummary } from '../../lib/types';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardTopbar } from './DashboardTopbar';

interface WorkspaceLayoutProps {
  workspace: WorkspaceSummary;
  onSignOut: () => Promise<void>;
  children: ReactNode;
}

export function WorkspaceLayout({ workspace, onSignOut, children }: WorkspaceLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-950 lg:pl-80">
      <DashboardSidebar workspace={workspace} />
      <main className="flex min-h-screen flex-1 flex-col bg-[#F7F4EE]">
        <DashboardTopbar workspace={workspace} onSignOut={onSignOut} />
        <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
