import { X } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { VoiceCallDetailResponse } from '../../lib/voice-ops-service';
import { Button } from '../ui/Button';
import { VoiceCallActionsPanel } from './VoiceCallActionsPanel';
import { VoiceCallArtifactsPanel } from './VoiceCallArtifactsPanel';
import { VoiceCallEventTimeline } from './VoiceCallEventTimeline';

function formatDateTime(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

interface VoiceCallDetailDrawerProps {
  isOpen: boolean;
  detail: VoiceCallDetailResponse | null;
  loading: boolean;
  retryingLead: boolean;
  retryingActionId: string | null;
  resolvingReview: boolean;
  onClose: () => void;
  onRetryLeadCreate: () => Promise<void> | void;
  onRetryAction: (actionRunId: string) => Promise<void> | void;
  onResolveReview: (reviewStatus: 'open' | 'resolved' | 'dismissed') => Promise<void> | void;
}

export function VoiceCallDetailDrawer({
  isOpen,
  detail,
  loading,
  retryingLead,
  retryingActionId,
  resolvingReview,
  onClose,
  onRetryLeadCreate,
  onRetryAction,
  onResolveReview,
}: VoiceCallDetailDrawerProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close voice call details"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70"
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-4xl flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-200">Voice call</div>
            <h2 className="mt-2 truncate font-display text-2xl text-white">
              {detail?.call.from_number_e164 ?? 'Loading...'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {detail?.call.outcome_status ?? 'Inspect routing, gather, CRM creation, and recovery actions.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {loading || !detail ? (
            <div className="text-sm text-slate-400">Loading voice call detail...</div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Assistant</div>
                  <div className="mt-2 text-white">{detail.call.voice_agent_name ?? detail.call.runtime_mode}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Number</div>
                  <div className="mt-2 text-white">{detail.call.phone_number_e164_label ?? detail.call.to_number_e164}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Last webhook: {formatDateTime(detail.call.voice_number_last_webhook_observed_at ?? null)}
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Gather</div>
                  <div className="mt-2 text-white">{detail.call.gather_status}</div>
                  <div className="mt-1 text-xs text-slate-500">{detail.call.provider_gather_status ?? 'No provider gather status'}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Review</div>
                  <div className="mt-2 text-white">{detail.call.review_status}</div>
                  <div className="mt-1 text-xs text-slate-500">{detail.call.outcome_error ?? detail.call.outcome_reason ?? 'No failure note'}</div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                <div>Created: {formatDateTime(detail.call.created_at)}</div>
                <div className="mt-2">Ended: {formatDateTime(detail.call.ended_at)}</div>
                <div className="mt-2">Runtime: {detail.call.runtime_mode}</div>
                {detail.call.record_id ? (
                  <div className="mt-3">
                    <Link className="text-cyan-200 hover:text-cyan-100" to={`/records/${detail.call.record_id}`}>
                      Open linked CRM record
                    </Link>
                  </div>
                ) : null}
              </div>

              <VoiceCallActionsPanel
                call={detail.call}
                actionRuns={detail.action_runs}
                retryingLead={retryingLead}
                retryingActionId={retryingActionId}
                resolvingReview={resolvingReview}
                onRetryLeadCreate={onRetryLeadCreate}
                onRetryAction={onRetryAction}
                onResolveReview={onResolveReview}
              />

              <VoiceCallArtifactsPanel call={detail.call} artifacts={detail.artifacts} />
              <VoiceCallEventTimeline events={detail.events} />
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-white/10 px-4 py-4 sm:px-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </aside>
    </div>
  );
}
