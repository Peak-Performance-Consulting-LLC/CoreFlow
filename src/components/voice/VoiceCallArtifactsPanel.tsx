import type { VoiceOpsArtifactRecord, VoiceOpsCallRecord } from '../../lib/voice-ops-service';
import { Card } from '../ui/Card';

function renderArtifactBody(artifact: VoiceOpsArtifactRecord) {
  if (artifact.content_text) {
    return artifact.content_text;
  }

  if (artifact.content_json && Object.keys(artifact.content_json).length > 0) {
    return JSON.stringify(artifact.content_json, null, 2);
  }

  if (artifact.status === 'failed') {
    return artifact.error_text ?? 'Artifact generation failed.';
  }

  return 'Artifact not generated yet.';
}

interface VoiceCallArtifactsPanelProps {
  call: VoiceOpsCallRecord;
  artifacts: VoiceOpsArtifactRecord[];
}

export function VoiceCallArtifactsPanel({ call, artifacts }: VoiceCallArtifactsPanelProps) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-[0.28em] text-accent-blue">Artifacts</div>
      <div className="mt-4 space-y-4">
        {artifacts.length === 0 ? (
          <div className="rounded-3xl border border-[#E7DED2] bg-[#FFFDFC] p-4">
            <div className="text-sm text-slate-700">Raw message history</div>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-slate-600">
              {call.message_history ? JSON.stringify(call.message_history, null, 2) : 'No message history stored.'}
            </pre>
          </div>
        ) : artifacts.map((artifact) => (
          <div key={artifact.id} className="rounded-3xl border border-[#E7DED2] bg-[#FFFDFC] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-slate-900">{artifact.artifact_type}</div>
              <div className="text-xs text-slate-500">{artifact.status}</div>
            </div>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-slate-600">
              {renderArtifactBody(artifact)}
            </pre>
          </div>
        ))}
      </div>
    </Card>
  );
}
