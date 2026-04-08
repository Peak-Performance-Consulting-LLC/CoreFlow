import type { VoiceOpsCallRecord } from '../../lib/voice-ops-service';
import { Card } from '../ui/Card';

function formatDateTime(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function badgeClass(value: string | null) {
  if (value === 'lead_created' || value === 'resolved') {
    return 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100';
  }

  if (value === 'open' || value === 'review_needed' || value === 'gather_incomplete') {
    return 'border-amber-300/30 bg-amber-400/10 text-amber-100';
  }

  if (value === 'crm_failed' || value === 'mapping_failed' || value === 'ended_without_lead' || value === 'failed') {
    return 'border-rose-300/30 bg-rose-400/10 text-rose-100';
  }

  return 'border-white/10 bg-white/5 text-slate-200';
}

interface VoiceCallsTableProps {
  calls: VoiceOpsCallRecord[];
  loading: boolean;
  selectedCallId: string | null;
  onSelect: (voiceCallId: string) => void;
}

export function VoiceCallsTable({ calls, loading, selectedCallId, onSelect }: VoiceCallsTableProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="text-xs uppercase tracking-[0.28em] text-cyan-200">Voice queue</div>
        <div className="mt-2 text-sm text-slate-400">Every inbound call is visible here, whether it created a lead or needs review.</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Caller</th>
              <th className="px-5 py-3 font-medium">Number</th>
              <th className="px-5 py-3 font-medium">Assistant</th>
              <th className="px-5 py-3 font-medium">Outcome</th>
              <th className="px-5 py-3 font-medium">Review</th>
              <th className="px-5 py-3 font-medium">Gather</th>
              <th className="px-5 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  {loading ? 'Loading calls...' : 'No voice calls match these filters yet.'}
                </td>
              </tr>
            ) : calls.map((call) => (
              <tr
                key={call.id}
                onClick={() => onSelect(call.id)}
                className={`cursor-pointer border-t border-white/5 transition hover:bg-white/[0.03] ${
                  selectedCallId === call.id ? 'bg-white/[0.04]' : ''
                }`}
              >
                <td className="px-5 py-4 align-top">
                  <div className="font-medium text-white">{call.from_number_e164}</div>
                  <div className="mt-1 text-xs text-slate-500">{call.provider_call_control_id}</div>
                </td>
                <td className="px-5 py-4 align-top text-slate-200">{call.phone_number_e164_label ?? call.to_number_e164}</td>
                <td className="px-5 py-4 align-top text-slate-200">{call.voice_agent_name ?? 'Phase 1 flow'}</td>
                <td className="px-5 py-4 align-top">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${badgeClass(call.outcome_status)}`}>
                    {call.outcome_status ?? 'pending'}
                  </span>
                  {call.record_id ? <div className="mt-2 text-xs text-cyan-200">Linked record</div> : null}
                </td>
                <td className="px-5 py-4 align-top">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${badgeClass(call.review_status)}`}>
                    {call.review_status}
                  </span>
                </td>
                <td className="px-5 py-4 align-top text-slate-200">{call.gather_status}</td>
                <td className="px-5 py-4 align-top text-slate-400">{formatDateTime(call.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
