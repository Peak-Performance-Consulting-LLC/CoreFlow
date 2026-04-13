import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { PhoneIncoming, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { WorkspaceLayout } from '../components/dashboard/WorkspaceLayout';
import { VoiceNumberPurchaseDrawer } from '../components/voice/VoiceNumberPurchaseDrawer';
import { VoiceAgentsPanel } from '../components/voice/VoiceAgentsPanel';
import { VoiceNumberSearchCard } from '../components/voice/VoiceNumberSearchCard';
import { VoiceNumberTable } from '../components/voice/VoiceNumberTable';
import { Card } from '../components/ui/Card';
import { FullPageLoader } from '../components/ui/FullPageLoader';
import { SectionSkeleton } from '../components/ui/SectionSkeleton';
import { useAuth } from '../hooks/useAuth';
import type { VoiceNumberRecord, VoiceNumberSearchResult } from '../lib/voice-service';
import {
  listVoiceNumbers,
  purchaseVoiceNumber,
  reconcileVoiceNumber,
  searchVoiceNumbers,
  updateVoiceNumber,
} from '../lib/voice-service';

function createDraftMap(numbers: VoiceNumberRecord[]) {
  return Object.fromEntries(
    numbers.map((number) => [
      number.id,
      {
        label: number.label ?? '',
        is_active: number.is_active,
      },
    ]),
  );
}

export function VoiceSettingsPage() {
  const navigate = useNavigate();
  const { session, workspace, signOut, user } = useAuth();
  const [numbers, setNumbers] = useState<VoiceNumberRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { label: string; is_active: boolean }>>({});
  const [numbersLoading, setNumbersLoading] = useState(true);
  const [numbersError, setNumbersError] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<VoiceNumberSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<VoiceNumberSearchResult | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    locality: '',
    administrative_area: '',
    npa: '',
    limit: 10,
    phone_number_type: '' as 'local' | 'toll_free' | '',
  });

  const isOwner = Boolean(workspace && user && workspace.ownerId === user.id);
  const readyCount = numbers.filter((number) => number.webhook_status === 'ready').length;
  const activeCount = numbers.filter((number) => number.is_active).length;

  async function handleSignOut() {
    await signOut();
    toast.success('Signed out successfully.');
    navigate('/signin', { replace: true });
  }

  async function loadNumbers() {
    if (!session || !workspace || !isOwner) {
      setNumbers([]);
      setDrafts({});
      setNumbersLoading(false);
      return;
    }

    setNumbersLoading(true);
    setNumbersError('');

    try {
      const response = await listVoiceNumbers(session, workspace.id, true);
      setNumbers(response.numbers);
      setDrafts(createDraftMap(response.numbers));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load voice numbers.';
      setNumbersError(message);
    } finally {
      setNumbersLoading(false);
    }
  }

  useEffect(() => {
    void loadNumbers();
  }, [session, workspace?.id, isOwner]);

  function updateDraft(voiceNumberId: string, patch: Partial<{ label: string; is_active: boolean }>) {
    setDrafts((current) => ({
      ...current,
      [voiceNumberId]: {
        label: current[voiceNumberId]?.label ?? numbers.find((item) => item.id === voiceNumberId)?.label ?? '',
        is_active:
          current[voiceNumberId]?.is_active ?? numbers.find((item) => item.id === voiceNumberId)?.is_active ?? false,
        ...patch,
      },
    }));
  }

  async function handleSearch() {
    if (!session || !workspace) {
      return;
    }

    setSearching(true);
    setHasSearched(true);

    try {
      const response = await searchVoiceNumbers(session, {
        workspace_id: workspace.id,
        locality: filters.locality || undefined,
        administrative_area: filters.administrative_area || undefined,
        npa: filters.npa || undefined,
        limit: filters.limit,
        phone_number_type: filters.phone_number_type || undefined,
      });
      setSearchResults(response.results);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to search voice numbers.';
      toast.error(message);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(label: string) {
    if (!session || !workspace || !selectedResult) {
      return;
    }

    setPurchasing(true);

    try {
      const response = await purchaseVoiceNumber(session, {
        workspace_id: workspace.id,
        phone_number: selectedResult.phoneNumber,
        label: label || undefined,
      });
      toast.success(response.webhookReady ? 'Voice number provisioned.' : 'Voice number saved as pending.');

      if (!response.webhookReady && response.number.last_provisioning_error) {
        toast.error(response.number.last_provisioning_error);
      }

      setSelectedResult(null);
      setSearchResults((current) => current.filter((item) => item.phoneNumber !== selectedResult.phoneNumber));
      await loadNumbers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to provision voice number.';
      toast.error(message);
    } finally {
      setPurchasing(false);
    }
  }

  async function handleSaveNumber(voiceNumberId: string) {
    if (!session || !workspace) {
      return;
    }

    const draft = drafts[voiceNumberId];

    if (!draft) {
      return;
    }

    setSavingId(voiceNumberId);

    try {
      const response = await updateVoiceNumber(session, {
        workspace_id: workspace.id,
        voice_number_id: voiceNumberId,
        label: draft.label,
        is_active: draft.is_active,
      });
      setNumbers((current) => current.map((item) => (item.id === voiceNumberId ? response.number : item)));
      setDrafts((current) => ({
        ...current,
        [voiceNumberId]: {
          label: response.number.label ?? '',
          is_active: response.number.is_active,
        },
      }));
      toast.success('Voice number updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update voice number.';
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleReconcileNumber(voiceNumberId: string) {
    if (!session || !workspace) {
      return;
    }

    setReconcilingId(voiceNumberId);

    try {
      const response = await reconcileVoiceNumber(session, {
        workspace_id: workspace.id,
        voice_number_id: voiceNumberId,
      });
      setNumbers((current) => current.map((item) => (item.id === voiceNumberId ? response.number : item)));
      setDrafts((current) => ({
        ...current,
        [voiceNumberId]: {
          label: response.number.label ?? '',
          is_active: response.number.is_active,
        },
      }));
      toast.success(response.provisioningInProgress ? 'Provisioning is already in progress.' : 'Voice number status refreshed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reconcile voice number.';
      toast.error(message);
    } finally {
      setReconcilingId(null);
    }
  }

  if (!session || !workspace) {
    return <FullPageLoader label="Loading voice settings..." />;
  }

  if (!isOwner) {
    return <Navigate to={`/dashboard/${workspace.crmType}`} replace />;
  }

  return (
    <WorkspaceLayout workspace={workspace} onSignOut={handleSignOut}>
      <div className="space-y-6">
        <Card className="overflow-hidden p-6">
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-accent-blue">Voice settings</div>
              <h1 className="mt-2 font-display text-4xl text-slate-900">Workspace voice number foundation</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Provision and manage the workspace phone number through CoreFlow's managed backend. Phase 1 is limited
                to US number inventory, owner-only access, and inbound routing compatibility with the existing Telnyx
                webhook foundation.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[26px] border border-[#D8CCBD] bg-[#F6EFE4] p-5">
                <div className="flex items-center gap-3 text-[#7A5C33]">
                  <PhoneIncoming className="h-5 w-5" />
                  Active numbers
                </div>
                <div className="mt-4 font-display text-4xl text-slate-900">{activeCount}</div>
              </div>

              <div className="rounded-[26px] border border-[#D8CCBD] bg-[#F5EFE5] p-5">
                <div className="flex items-center gap-3 text-[#6C5737]">
                  <ShieldCheck className="h-5 w-5" />
                  Webhook ready
                </div>
                <div className="mt-4 font-display text-4xl text-slate-900">{readyCount}</div>
              </div>

              <div className="rounded-[26px] border border-[#E7DED2] bg-[#FFFDFC] p-5">
                <div className="flex items-center gap-3 text-slate-700">
                  <Sparkles className="h-5 w-5" />
                  Managed provider
                </div>
              <div className="mt-4 text-sm leading-7 text-slate-600">
                  Workspace owners never manage raw provider credentials, connection IDs, or webhook configuration
                  directly.
                </div>
                <div className="mt-4">
                  <Link
                    to="/voice"
                    className="inline-flex items-center rounded-2xl border border-[#E7DED2] bg-[#F7F4EE] px-4 py-2 text-sm text-slate-700 transition hover:bg-[#EFE7DC]"
                  >
                    Open Voice Ops
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {numbersLoading ? (
          <SectionSkeleton title="Voice numbers" rows={5} />
        ) : numbersError ? (
          <Card className="border border-[#E1B9A8] bg-[#FAEEE8] p-4 text-sm text-[#8B5A4A]">{numbersError}</Card>
        ) : (
          <VoiceNumberTable
            numbers={numbers}
            drafts={drafts}
            savingId={savingId}
            reconcilingId={reconcilingId}
            onLabelChange={(voiceNumberId, label) => updateDraft(voiceNumberId, { label })}
            onActiveChange={(voiceNumberId, isActive) => updateDraft(voiceNumberId, { is_active: isActive })}
            onSave={handleSaveNumber}
            onReconcile={handleReconcileNumber}
          />
        )}

        <VoiceAgentsPanel session={session} workspaceId={workspace.id} numbers={numbers} />

        <VoiceNumberSearchCard
          filters={filters}
          loading={searching}
          results={searchResults}
          hasSearched={hasSearched}
          onFilterChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          onSearch={handleSearch}
          onPurchaseClick={(result) => setSelectedResult(result)}
        />
      </div>

      <VoiceNumberPurchaseDrawer
        isOpen={Boolean(selectedResult)}
        result={selectedResult}
        submitting={purchasing}
        onClose={() => {
          if (!purchasing) {
            setSelectedResult(null);
          }
        }}
        onSubmit={handlePurchase}
      />
    </WorkspaceLayout>
  );
}
