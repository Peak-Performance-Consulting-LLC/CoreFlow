import { CRMSelector } from '../ui/CRMSelector';
import { Input } from '../ui/Input';
import type { CRMType } from '../../lib/types';

interface WorkspaceSetupFieldsProps {
  workspaceName: string;
  workspaceSlug: string;
  crmType: CRMType;
  errors: Partial<Record<'workspaceName' | 'workspaceSlug' | 'crmType', string>>;
  onWorkspaceNameChange: (value: string) => void;
  onWorkspaceSlugChange: (value: string) => void;
  onCrmTypeChange: (crmType: CRMType) => void;
}

export function WorkspaceSetupFields({
  workspaceName,
  workspaceSlug,
  crmType,
  errors,
  onWorkspaceNameChange,
  onWorkspaceSlugChange,
  onCrmTypeChange,
}: WorkspaceSetupFieldsProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="Workspace name"
          placeholder="CoreFlow Ventures"
          value={workspaceName}
          onChange={(event) => onWorkspaceNameChange(event.target.value)}
          error={errors.workspaceName}
        />
        <Input
          label="Workspace slug"
          placeholder="coreflow-ventures"
          value={workspaceSlug}
          onChange={(event) => onWorkspaceSlugChange(event.target.value)}
          error={errors.workspaceSlug}
          hint="Lowercase letters, numbers, and hyphens only."
        />
      </div>
      <CRMSelector value={crmType} onChange={onCrmTypeChange} error={errors.crmType} />
    </div>
  );
}
