import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, PhoneCall, RefreshCcw, Waves } from 'lucide-react';
import { toast } from 'sonner';
import { WorkspaceLayout } from '../components/dashboard/WorkspaceLayout';
import { VoiceCallDetailDrawer } from '../components/voice/VoiceCallDetailDrawer';
import { VoiceCallFilters, type VoiceCallFilterState } from '../components/voice/VoiceCallFilters';
import { VoiceCallsTable } from '../components/voice/VoiceCallsTable';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FullPageLoader } from '../components/ui/FullPageLoader';
import { useAuth } from '../hooks/useAuth';
import {
  getVoiceCallDetail,
  listVoiceCalls,
  resolveVoiceReview,
  retryVoiceAction,
  retryVoiceCallLeadCreate,
  type VoiceCallDetailResponse,
  type VoiceCallListResponse,
} from '../lib/voice-ops-service';

const defaultFilters: VoiceCallFilterState = {
  outcome_status: '',
  review_status: '',
  assistant_id: '',
  phone_number_id: '',
  has_record: 'all',
};

export function VoiceOpsPage() {
  const navigate = useNavigate();
  const { session, workspace, signOut, user } = useAuth();
  const [filters, setFilters] = useState<VoiceCallFilterState>(defaultFilters);
  const [listData, setListData] = useState<VoiceCallListResponse | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VoiceCallDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [retryingLead, setRetryingLead] = useState(false);
  const [retryingActionId, setRetryingActionId] = useState<string | null>(null);
  const [resolvingReview, setResolvingReview] = useState(false);

  const openReviewCount = useMemo(
    () => (listData?.calls ?? []).filter((call) => call.review_status === 'open').length,
    [listData],
  );
  const failedCount = useMemo(
    () => (listData?.calls ?? []).filter((call) => call.outcome_status && call.outcome_status !== 'lead_created').length,
    [listData],
  );
  const leadCount = useMemo(
    () => (listData?.calls ?? []).filter((call) => call.outcome_status === 'lead_created').length,
    [listData],
  );

  async function handleSignOut() {
    await signOut();
    toast.success('Signed out successfully.');
    navigate('/signin', { replace: true });
  }

  async function loadCalls(nextSelectedCallId?: string | null) {
    if (!session || !workspace) {
      return;
    }

    setListLoading(true);

    try {
      const result = await listVoiceCalls(session, {
        workspace_id: workspace.id,
        outcome_status: filters.outcome_status || null,
        review_status: filters.review_status || null,
        assistant_id: filters.assistant_id || null,
        phone_number_id: filters.phone_number_id || null,
        has_record: filters.has_record === 'all' ? null : filters.has_record === 'yes',
        page: 1,
        page_size: 25,
      });
      setListData(result);
      const preservedCallId = result.calls.some((call) => call.id === selectedCallId) ? selectedCallId : null;
      const nextCallId = nextSelectedCallId ?? preservedCallId ?? result.calls[0]?.id ?? null;
      setSelectedCallId(nextCallId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load voice calls.';
      toast.error(message);
    } finally {
      setListLoading(false);
    }
  }

  async function loadDetail(voiceCallId: string | null) {
    if (!session || !workspace || !voiceCallId) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);

    try {
      const result = await getVoiceCallDetail(session, workspace.id, voiceCallId);
      setDetail(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load voice call detail.';
      toast.error(message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (!session || !workspace) {
      return;
    }

    void loadCalls();
  }, [
    session,
    workspace?.id,
    filters.outcome_status,
    filters.review_status,
    filters.assistant_id,
    filters.phone_number_id,
    filters.has_record,
  ]);

  useEffect(() => {
    void loadDetail(selectedCallId);
  }, [selectedCallId, session, workspace?.id]);

  async function handleRetryLeadCreate() {
    if (!session || !workspace || !selectedCallId) {
      return;
    }

    setRetryingLead(true);

    try {
      await retryVoiceCallLeadCreate(session, workspace.id, selectedCallId);
      toast.success('Lead creation retried.');
      await loadCalls(selectedCallId);
      await loadDetail(selectedCallId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to retry lead creation.';
      toast.error(message);
    } finally {
      setRetryingLead(false);
    }
  }

  async function handleRetryAction(actionRunId: string) {
    if (!session || !workspace || !selectedCallId) {
      return;
    }

    setRetryingActionId(actionRunId);

    try {
      await retryVoiceAction(session, workspace.id, actionRunId);
      toast.success('Action retried.');
      await loadCalls(selectedCallId);
      await loadDetail(selectedCallId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to retry action.';
      toast.error(message);
    } finally {
      setRetryingActionId(null);
    }
  }

  async function handleResolveReview(reviewStatus: 'open' | 'resolved' | 'dismissed') {
    if (!session || !workspace || !selectedCallId) {
      return;
    }

    setResolvingReview(true);

    try {
      await resolveVoiceReview(session, {
        workspace_id: workspace.id,
        voice_call_id: selectedCallId,
        review_status: reviewStatus,
      });
      toast.success(`Review marked ${reviewStatus}.`);
      await loadCalls(selectedCallId);
      await loadDetail(selectedCallId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update review.';
      toast.error(message);
    } finally {
      setResolvingReview(false);
    }
  }

  if (!session || !workspace) {
    return <FullPageLoader label="Loading voice operations..." />;
  }

  const isOwner = workspace.ownerId === user?.id;

  return (
    <WorkspaceLayout workspace={workspace} onSignOut={handleSignOut}>
      <div className="space-y-6">
        <Card className="overflow-hidden p-6">
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-accent-blue">Voice operations</div>
              <h1 className="mt-2 font-display text-4xl text-slate-900">No missed inbound calls</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Inspect every inbound call, follow review-needed outcomes, retry lead creation safely, and trace the
                webhook-to-CRM path without leaving the workspace.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" variant="secondary" size="sm" onClick={() => void loadCalls(selectedCallId)} loading={listLoading}>
                  <RefreshCcw className="h-4 w-4" />
                  Refresh queue
                </Button>
                {isOwner ? (
                  <Link to="/settings/voice" className="inline-flex items-center rounded-2xl border border-[#E7DED2] bg-[#F7F4EE] px-4 py-2 text-sm text-slate-700 transition hover:bg-[#EFE7DC]">
                    Open voice settings
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[26px] border border-[#D8CCBD] bg-[#F6EFE4] p-5">
                <div className="flex items-center gap-3 text-[#7A5C33]">
                  <PhoneCall className="h-5 w-5" />
                  Calls loaded
                </div>
                <div className="mt-4 font-display text-4xl text-slate-900">{listData?.calls.length ?? 0}</div>
              </div>
              <div className="rounded-[26px] border border-[#D9C39D] bg-[#FAF3E6] p-5">
                <div className="flex items-center gap-3 text-[#7A5C33]">
                  <AlertTriangle className="h-5 w-5" />
                  Open review
                </div>
                <div className="mt-4 font-display text-4xl text-slate-900">{openReviewCount}</div>
              </div>
              <div className="rounded-[26px] border border-[#D8CCBD] bg-[#F5EFE5] p-5">
                <div className="flex items-center gap-3 text-[#6C5737]">
                  <Waves className="h-5 w-5" />
                  Leads created
                </div>
                <div className="mt-4 font-display text-4xl text-slate-900">{leadCount}</div>
                <div className="mt-2 text-xs text-[#6C5737]">Other non-success outcomes in view: {failedCount}</div>
              </div>
            </div>
          </div>
        </Card>

        <VoiceCallFilters
          filters={filters}
          calls={listData?.calls ?? []}
          loading={listLoading}
          onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          onReset={() => setFilters(defaultFilters)}
        />

        <VoiceCallsTable
          calls={listData?.calls ?? []}
          loading={listLoading}
          selectedCallId={selectedCallId}
          onSelect={setSelectedCallId}
        />
      </div>

      <VoiceCallDetailDrawer
        isOpen={Boolean(selectedCallId)}
        detail={detail}
        loading={detailLoading}
        retryingLead={retryingLead}
        retryingActionId={retryingActionId}
        resolvingReview={resolvingReview}
        onClose={() => setSelectedCallId(null)}
        onRetryLeadCreate={handleRetryLeadCreate}
        onRetryAction={handleRetryAction}
        onResolveReview={handleResolveReview}
      />
    </WorkspaceLayout>
  );
}
