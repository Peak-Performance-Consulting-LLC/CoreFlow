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
    return 'border-[#CCB893] bg-[#F5EFE5] text-[#6C5737]';
  }

  if (value === 'open' || value === 'review_needed' || value === 'gather_incomplete') {
    return 'border-[#D9C39D] bg-[#FAF3E6] text-[#7A5C33]';
  }

  if (value === 'crm_failed' || value === 'mapping_failed' || value === 'ended_without_lead' || value === 'failed') {
    return 'border-[#E1B9A8] bg-[#FAEEE8] text-[#8B5A4A]';
  }

  return 'border-[#E7DED2] bg-[#F7F4EE] text-slate-700';
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
      <div className="border-b border-[#E7DED2] px-5 py-4">
        <div className="text-xs uppercase tracking-[0.28em] text-accent-blue">Voice queue</div>
        <div className="mt-2 text-sm text-slate-600">Every inbound call is visible here, whether it created a lead or needs review.</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#FFFDFC] text-slate-600">
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
                <td colSpan={7} className="px-5 py-10 text-center text-slate-600">
                  {loading ? 'Loading calls...' : 'No voice calls match these filters yet.'}
                </td>
              </tr>
            ) : calls.map((call) => (
              <tr
                key={call.id}
                onClick={() => onSelect(call.id)}
                className={`cursor-pointer border-t border-[#EDE4D8] transition hover:bg-[#FFFDFC] ${
                  selectedCallId === call.id ? 'bg-[#FFFDFC]' : ''
                }`}
              >
                <td className="px-5 py-4 align-top">
                  <div className="font-medium text-slate-900">{call.from_number_e164}</div>
                  <div className="mt-1 text-xs text-slate-500">{call.provider_call_control_id}</div>
                </td>
                <td className="px-5 py-4 align-top text-slate-700">{call.phone_number_e164_label ?? call.to_number_e164}</td>
                <td className="px-5 py-4 align-top text-slate-700">{call.voice_agent_name ?? 'Phase 1 flow'}</td>
                <td className="px-5 py-4 align-top">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${badgeClass(call.outcome_status)}`}>
                    {call.outcome_status ?? 'pending'}
                  </span>
                  {call.record_id ? <div className="mt-2 text-xs text-[#7A5C33]">Linked record</div> : null}
                </td>
                <td className="px-5 py-4 align-top">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${badgeClass(call.review_status)}`}>
                    {call.review_status}
                  </span>
                </td>
                <td className="px-5 py-4 align-top text-slate-700">{call.gather_status}</td>
                <td className="px-5 py-4 align-top text-slate-600">{formatDateTime(call.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
