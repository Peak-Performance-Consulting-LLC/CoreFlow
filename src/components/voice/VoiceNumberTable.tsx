import { CheckCircle2, CircleOff, PhoneIncoming, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { VoiceNumberRecord } from '../../lib/voice-service';

interface VoiceNumberTableProps {
  numbers: VoiceNumberRecord[];
  drafts: Record<string, { label: string; is_active: boolean }>;
  savingId: string | null;
  reconcilingId: string | null;
  onLabelChange: (voiceNumberId: string, label: string) => void;
  onActiveChange: (voiceNumberId: string, isActive: boolean) => void;
  onSave: (voiceNumberId: string) => Promise<void>;
  onReconcile: (voiceNumberId: string) => Promise<void>;
}

function getProvisioningBadge(number: VoiceNumberRecord) {
  if (number.provisioning_status === 'active') {
    return 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200';
  }

  if (number.provisioning_status === 'pending') {
    return 'border-amber-300/20 bg-amber-400/10 text-amber-100';
  }

  if (number.provisioning_status === 'failed') {
    return 'border-rose-300/20 bg-rose-400/10 text-rose-100';
  }

  return 'border-slate-300/10 bg-white/[0.05] text-slate-300';
}

function getWebhookBadge(number: VoiceNumberRecord) {
  if (number.webhook_status === 'ready') {
    return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100';
  }

  if (number.webhook_status === 'failed') {
    return 'border-rose-300/20 bg-rose-400/10 text-rose-100';
  }

  return 'border-amber-300/20 bg-amber-400/10 text-amber-100';
}

export function VoiceNumberTable({
  numbers,
  drafts,
  savingId,
  reconcilingId,
  onLabelChange,
  onActiveChange,
  onSave,
  onReconcile,
}: VoiceNumberTableProps) {
  if (numbers.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100">
            <PhoneIncoming className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-2xl text-white">No voice numbers yet</h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
              Search US numbers below to provision the first workspace line. Once a number is purchased and active, the
              existing inbound Telnyx webhook flow can resolve this workspace from that number.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="text-xs uppercase tracking-[0.28em] text-cyan-200">Provisioned numbers</div>
        <h3 className="mt-2 font-display text-2xl text-white">Workspace voice inventory</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-0 text-sm text-slate-300">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.24em] text-slate-500">
              <th className="px-6 py-4">Number</th>
              <th className="px-6 py-4">Label</th>
              <th className="px-6 py-4">Provisioning</th>
              <th className="px-6 py-4">Webhook</th>
              <th className="px-6 py-4">Routing</th>
              <th className="px-6 py-4">Purchased</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {numbers.map((number) => {
              const draft = drafts[number.id] ?? {
                label: number.label ?? '',
                is_active: number.is_active,
              };
              const isDirty = draft.label !== (number.label ?? '') || draft.is_active !== number.is_active;
              const isSaving = savingId === number.id;
              const isReconciling = reconcilingId === number.id;
              const needsReconcile = number.provisioning_status !== 'active' || number.webhook_status !== 'ready';

              return (
                <tr key={number.id} className="border-t border-white/10">
                  <td className="px-6 py-5 align-top">
                    <div className="font-semibold text-white">{number.phone_number_e164}</div>
                    <div className="mt-1 text-xs text-slate-500">Managed workspace line</div>
                    {number.last_provisioning_error ? (
                      <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs leading-6 text-rose-100">
                        {number.last_provisioning_error}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-6 py-5 align-top">
                    <input
                      value={draft.label}
                      onChange={(event) => onLabelChange(number.id, event.target.value)}
                      placeholder="Front desk line"
                      className="h-11 w-full min-w-[220px] rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white placeholder:text-slate-500"
                    />
                  </td>
                  <td className="px-6 py-5 align-top">
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${getProvisioningBadge(number)}`}
                    >
                      {number.provisioning_status}
                    </div>
                  </td>
                  <td className="px-6 py-5 align-top">
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${getWebhookBadge(number)}`}
                    >
                      {number.webhook_status}
                    </div>
                  </td>
                  <td className="px-6 py-5 align-top">
                    <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <input
                        type="checkbox"
                        checked={draft.is_active}
                        onChange={(event) => onActiveChange(number.id, event.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-slate-950/70"
                      />
                      <span className="text-sm text-white">{draft.is_active ? 'Active' : 'Paused'}</span>
                      {draft.is_active ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      ) : (
                        <CircleOff className="h-4 w-4 text-slate-500" />
                      )}
                    </label>
                  </td>
                  <td className="px-6 py-5 align-top">
                    <div className="text-sm text-white">{number.purchased_at ? new Date(number.purchased_at).toLocaleString() : 'Unknown'}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {number.webhook_status === 'ready' ? 'Inbound routing ready' : 'Inbound routing pending'}
                    </div>
                  </td>
                  <td className="px-6 py-5 align-top">
                    <div className="flex items-center justify-end gap-3">
                      {number.webhook_status !== 'ready' ? (
                        <span className="inline-flex items-center gap-2 text-xs text-amber-100">
                          <ShieldAlert className="h-4 w-4" />
                          Pending routing
                        </span>
                      ) : null}
                      {needsReconcile ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          loading={isReconciling}
                          disabled={isSaving}
                          onClick={() => void onReconcile(number.id)}
                        >
                          Refresh status
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant={isDirty ? 'primary' : 'secondary'}
                        disabled={!isDirty || isReconciling}
                        loading={isSaving}
                        onClick={() => void onSave(number.id)}
                      >
                        Save
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
