import { PhoneIncoming, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import type { VoiceNumberSearchResult } from '../../lib/voice-service';

interface VoiceNumberPurchaseDrawerProps {
  isOpen: boolean;
  result: VoiceNumberSearchResult | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (label: string) => Promise<void>;
}

function formatLocation(result: VoiceNumberSearchResult | null) {
  if (!result) {
    return 'US';
  }

  return [result.locality, result.administrativeArea, result.countryCode].filter(Boolean).join(', ') || 'US';
}

export function VoiceNumberPurchaseDrawer({
  isOpen,
  result,
  submitting,
  onClose,
  onSubmit,
}: VoiceNumberPurchaseDrawerProps) {
  const [label, setLabel] = useState('');

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setLabel('');

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 transition ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Close voice number purchase drawer"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/70 transition duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      />

      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl transition duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-number-purchase-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-200">Provision number</div>
            <h2 id="voice-number-purchase-title" className="mt-2 truncate font-display text-2xl text-white">
              Confirm workspace number
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              CoreFlow will provision this number through the managed backend and attach it to the workspace routing
              foundation.
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
          {result ? (
            <div className="space-y-5">
              <div className="rounded-[28px] border border-cyan-300/20 bg-cyan-300/10 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-2xl border border-cyan-300/20 bg-slate-950/40 p-2 text-cyan-100">
                    <PhoneIncoming className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-3xl text-white">{result.phoneNumber}</h3>
                    <p className="mt-1 text-sm text-cyan-100/80">
                      {formatLocation(result)} • {result.phoneNumberType ?? 'standard'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-cyan-100/80 sm:grid-cols-2">
                  <div>Monthly cost: {result.monthlyCost ?? 'Unknown'}</div>
                  <div>Upfront cost: {result.upfrontCost ?? 'Unknown'}</div>
                  <div>Quickship: {result.quickship ? 'Yes' : 'No'}</div>
                  <div>Features: {result.features.length > 0 ? result.features.join(', ') : 'Not listed'}</div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span className="font-medium">Workspace label</span>
                  <input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="Front desk line"
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white placeholder:text-slate-500"
                  />
                </label>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Provider-side setup stays fully managed by CoreFlow. Workspace owners only see the product-facing
                  number management flow here.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 px-4 py-4 sm:px-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSubmit(label)} loading={submitting} disabled={!result}>
            Provision number
          </Button>
        </div>
      </aside>
    </div>
  );
}
