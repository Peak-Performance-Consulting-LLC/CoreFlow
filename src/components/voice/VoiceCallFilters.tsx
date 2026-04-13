import type { VoiceCallListQuery, VoiceOpsCallRecord } from '../../lib/voice-ops-service';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export interface VoiceCallFilterState {
  outcome_status: '' | VoiceCallListQuery['outcome_status'];
  review_status: '' | VoiceCallListQuery['review_status'];
  assistant_id: string;
  phone_number_id: string;
  has_record: 'all' | 'yes' | 'no';
}

interface VoiceCallFiltersProps {
  filters: VoiceCallFilterState;
  calls: VoiceOpsCallRecord[];
  loading: boolean;
  onChange: (patch: Partial<VoiceCallFilterState>) => void;
  onReset: () => void;
}

export function VoiceCallFilters({ filters, calls, loading, onChange, onReset }: VoiceCallFiltersProps) {
  const assistantOptions = Array.from(
    new Map(
      calls
        .filter((call) => call.voice_agent_id && call.voice_agent_name)
        .map((call) => [call.voice_agent_id as string, call.voice_agent_name as string]),
    ).entries(),
  );
  const numberOptions = Array.from(
    new Map(
      calls
        .filter((call) => call.workspace_phone_number_id)
        .map((call) => [call.workspace_phone_number_id, call.phone_number_e164_label ?? call.to_number_e164]),
    ).entries(),
  );

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-accent-blue">Filters</div>
            <div className="mt-2 text-sm text-slate-600">Slice the inbound queue by outcome, review state, agent, and number.</div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={loading}>
            Reset
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2 text-sm text-slate-700">
            <span>Outcome</span>
            <select
              value={filters.outcome_status ?? ''}
              onChange={(event) => onChange({ outcome_status: event.target.value as VoiceCallFilterState['outcome_status'] })}
              className="h-11 w-full rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] px-4 text-slate-900 outline-none"
            >
              <option value="">All outcomes</option>
              <option value="lead_created">Lead created</option>
              <option value="crm_failed">CRM failed</option>
              <option value="gather_incomplete">Gather incomplete</option>
              <option value="mapping_failed">Mapping failed</option>
              <option value="ended_without_lead">Ended without lead</option>
              <option value="review_needed">Review needed</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span>Review</span>
            <select
              value={filters.review_status ?? ''}
              onChange={(event) => onChange({ review_status: event.target.value as VoiceCallFilterState['review_status'] })}
              className="h-11 w-full rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] px-4 text-slate-900 outline-none"
            >
              <option value="">All review states</option>
              <option value="open">Open review</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
              <option value="not_needed">Not needed</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span>Assistant</span>
            <select
              value={filters.assistant_id}
              onChange={(event) => onChange({ assistant_id: event.target.value })}
              className="h-11 w-full rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] px-4 text-slate-900 outline-none"
            >
              <option value="">All assistants</option>
              {assistantOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span>Number</span>
            <select
              value={filters.phone_number_id}
              onChange={(event) => onChange({ phone_number_id: event.target.value })}
              className="h-11 w-full rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] px-4 text-slate-900 outline-none"
            >
              <option value="">All numbers</option>
              {numberOptions.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span>CRM record</span>
            <select
              value={filters.has_record}
              onChange={(event) => onChange({ has_record: event.target.value as VoiceCallFilterState['has_record'] })}
              className="h-11 w-full rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] px-4 text-slate-900 outline-none"
            >
              <option value="all">All calls</option>
              <option value="yes">With record</option>
              <option value="no">Without record</option>
            </select>
          </label>
        </div>
      </div>
    </Card>
  );
}
