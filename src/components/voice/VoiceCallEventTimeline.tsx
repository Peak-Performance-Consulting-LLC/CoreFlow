import type { VoiceOpsEventRecord } from '../../lib/voice-ops-service';
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

interface VoiceCallEventTimelineProps {
  events: VoiceOpsEventRecord[];
}

export function VoiceCallEventTimeline({ events }: VoiceCallEventTimelineProps) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-[0.28em] text-cyan-200">Webhook events</div>
      <div className="mt-4 space-y-3">
        {events.length === 0 ? (
          <div className="text-sm text-slate-400">No event history is available for this call yet.</div>
        ) : events.map((event) => (
          <div key={event.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-white">{event.event_type}</div>
              <div className="text-xs text-slate-500">{formatDateTime(event.occurred_at)}</div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Processing: {event.processing_status}
              {event.processing_error ? ` • ${event.processing_error}` : ''}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
