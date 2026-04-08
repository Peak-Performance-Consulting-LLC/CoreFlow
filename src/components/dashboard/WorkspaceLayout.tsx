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
    <div className="flex min-h-screen bg-surface-950">
      <DashboardSidebar workspace={workspace} />
      <main className="flex min-h-screen flex-1 flex-col">
        <DashboardTopbar workspace={workspace} onSignOut={onSignOut} />
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
