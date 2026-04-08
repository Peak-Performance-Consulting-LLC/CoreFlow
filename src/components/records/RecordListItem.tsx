import {
  ArrowUpRight,
  CheckSquare,
  Ellipsis,
  ExternalLink,
  MessageSquarePlus,
  PencilLine,
  Shuffle,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CrmWorkspaceConfig, RecordSummary } from '../../lib/crm-types';
import type { CRMType } from '../../lib/types';
import {
  getRecordFollowUpSummary,
  formatRecordCreatedDate,
  formatRelativeDateTime,
  getRecordIdentity,
  getRecordTypeLabel,
  getSourceName,
  getStageDetails,
  getStageName,
} from '../../lib/record-workbench';
import { cn } from '../../lib/utils';
import type { RecordQuickActionMode } from './RecordQuickActionDrawer';

export const recordListGridClassName =
  'grid min-w-[1260px] grid-cols-[minmax(320px,2.35fr)_minmax(140px,1fr)_minmax(130px,0.9fr)_minmax(130px,0.9fr)_minmax(140px,1fr)_minmax(160px,1fr)_minmax(220px,1.15fr)_64px] items-center gap-4';

interface RecordListItemProps {
  record: RecordSummary;
  config: CrmWorkspaceConfig;
  crmType: CRMType;
  onEditLead: (record: RecordSummary) => void;
  onOpenAction: (record: RecordSummary, mode: Exclude<RecordQuickActionMode, null>) => void;
}

function formatStatusLabel(status: string | null | undefined) {
  const value = status?.trim();

  if (!value) {
    return 'Open';
  }

  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function pillStyles(tone: 'neutral' | 'type' | 'source' | 'stage' | 'closed' | 'status') {
  switch (tone) {
    case 'type':
      return 'border-indigo-300/20 bg-indigo-300/10 text-indigo-100';
    case 'source':
      return 'border-white/10 bg-white/[0.04] text-slate-200';
    case 'stage':
      return 'border-sky-300/20 bg-sky-300/10 text-sky-100';
    case 'closed':
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
    case 'status':
      return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100';
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-300';
  }
}

function followUpStyles(tone: ReturnType<typeof getRecordFollowUpSummary>['tone']) {
  switch (tone) {
    case 'overdue':
      return 'border-rose-300/30 bg-rose-300/10 text-rose-100';
    case 'today':
      return 'border-amber-300/30 bg-amber-300/10 text-amber-100';
    case 'pending':
      return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100';
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-300';
  }
}

function RowActionsMenu({
  record,
  onEditLead,
  onOpenAction,
}: Pick<RecordListItemProps, 'record' | 'onEditLead' | 'onOpenAction'>) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const actions: Array<{
    label: string;
    icon: typeof ExternalLink;
    onSelect: () => void;
  }> = [
    {
      label: 'View details',
      icon: ExternalLink,
      onSelect: () => navigate(`/records/${record.id}`),
    },
    {
      label: 'Edit record',
      icon: PencilLine,
      onSelect: () => onEditLead(record),
    },
    {
      label: 'Add note',
      icon: MessageSquarePlus,
      onSelect: () => onOpenAction(record, 'note'),
    },
    {
      label: 'Create task',
      icon: CheckSquare,
      onSelect: () => onOpenAction(record, 'task'),
    },
    {
      label: 'Move stage',
      icon: Shuffle,
      onSelect: () => onOpenAction(record, 'stage'),
    },
    {
      label: 'Assign owner',
      icon: Users,
      onSelect: () => onOpenAction(record, 'owner'),
    },
  ];

  return (
    <div ref={menuRef} className="relative flex justify-end">
      <button
        type="button"
        aria-label={`Open actions for ${record.title}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:border-cyan-300/30 hover:bg-white/[0.08] hover:text-white"
      >
        <Ellipsis className="h-4 w-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-30 w-56 rounded-[24px] border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
        >
          <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Actions
          </div>
          <div className="space-y-1">
            {actions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    action.onSelect();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Icon className="h-4 w-4 text-slate-400" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RecordListItem({
  record,
  config,
  crmType,
  onEditLead,
  onOpenAction,
}: RecordListItemProps) {
  const identity = useMemo(() => getRecordIdentity(record), [record]);
  const typeLabel = useMemo(() => getRecordTypeLabel(record, config, crmType), [record, config, crmType]);
  const stage = useMemo(() => getStageDetails(config, record.stage_id), [config, record.stage_id]);
  const sourceName = useMemo(
    () => getSourceName(config, record.source_id, record.imported_from ?? null),
    [config, record.source_id, record.imported_from],
  );
  const ownerName = useMemo(
    () => config.assignees.find((assignee) => assignee.userId === record.assignee_user_id)?.fullName ?? 'Unassigned',
    [config.assignees, record.assignee_user_id],
  );
  const followUp = useMemo(() => getRecordFollowUpSummary(record), [record]);
  const phone = record.phone?.trim() || null;
  const statusLabel = formatStatusLabel(record.status);
  const followUpHref = `/records/${record.id}#tasks`;

  return (
    <div
      className={cn(
        recordListGridClassName,
        'group border-b border-white/10 px-5 py-4 text-sm transition duration-150 hover:bg-white/[0.03]',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
            {identity.initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/records/${record.id}`}
                className="truncate text-sm font-semibold text-white transition group-hover:text-cyan-100"
              >
                {identity.title}
              </Link>
              {identity.supportingTag ? (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300">
                  {identity.supportingTag}
                </span>
              ) : null}
            </div>
            <div className="mt-1 truncate text-sm text-slate-400">{identity.subtitle}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className={cn('rounded-full border px-2 py-1 font-medium', pillStyles('status'))}>
                {statusLabel}
              </span>
              <span className={cn('rounded-full border px-2 py-1 text-slate-300', pillStyles('neutral'))}>
                Owner: {ownerName}
              </span>
              {(record.open_task_count ?? 0) > 0 ? (
                <span className={cn('rounded-full border px-2 py-1 text-slate-300', pillStyles('neutral'))}>
                  {record.open_task_count} open task{record.open_task_count === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        {phone ? (
          <a href={`tel:${phone}`} className="text-sm font-medium text-slate-200 transition hover:text-cyan-100">
            {phone}
          </a>
        ) : (
          <span className="text-sm text-slate-500">No phone</span>
        )}
      </div>

      <div className="min-w-0">
        <span className={cn('inline-flex max-w-full truncate rounded-full border px-3 py-1.5 text-xs font-medium', pillStyles('type'))}>
          {typeLabel}
        </span>
      </div>

      <div className="min-w-0">
        <span
          className={cn(
            'inline-flex max-w-full truncate rounded-full border px-3 py-1.5 text-xs font-medium',
            stage?.is_closed ? pillStyles('closed') : pillStyles('stage'),
          )}
        >
          {getStageName(config, record.stage_id)}
        </span>
        <div className="mt-1 text-xs text-slate-500">{record.priority ? `${record.priority} priority` : 'No priority'}</div>
      </div>

      <div className="min-w-0">
        <span className={cn('inline-flex max-w-full truncate rounded-full border px-3 py-1.5 text-xs font-medium', pillStyles('source'))}>
          {sourceName}
        </span>
        <div className="mt-1 text-xs text-slate-500">{ownerName}</div>
      </div>

      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-200">{formatRecordCreatedDate(record.created_at)}</div>
        <div className="mt-1 text-xs text-slate-500">Updated {formatRelativeDateTime(record.updated_at)}</div>
      </div>

      <div className="min-w-0">
        <Link
          to={followUpHref}
          aria-label={`Open follow-up details for ${record.title}`}
          className="group/followup block rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40"
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                'inline-flex max-w-full truncate rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]',
                followUpStyles(followUp.tone),
              )}
            >
              {followUp.label}
            </span>
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-hover/followup:text-cyan-100" />
          </div>
          <div className="mt-2 truncate text-sm font-medium text-white transition group-hover/followup:text-cyan-50">
            {followUp.taskTitle}
          </div>
          <div className="mt-1 text-xs text-slate-400">{followUp.detail}</div>
          <div className="mt-2 text-xs text-slate-500">
            Last activity {formatRelativeDateTime(record.last_activity_at ?? record.updated_at)}
          </div>
        </Link>
      </div>

      <RowActionsMenu record={record} onEditLead={onEditLead} onOpenAction={onOpenAction} />
    </div>
  );
}
