import type { Session } from '@supabase/supabase-js';
import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { CrmWorkspaceConfig, RecordDetailResponse, RecordSaveInput, RecordSummary } from '../../lib/crm-types';
import { getCachedRecordDetails, getRecordDetails, updateRecord } from '../../lib/crm-service';
import { RecordForm } from './RecordForm';

interface RecordEditDrawerProps {
  isOpen: boolean;
  record: RecordSummary | null;
  workspaceId: string;
  session: Session;
  config: CrmWorkspaceConfig;
  onClose: () => void;
  onSaved: (detail: RecordDetailResponse) => void;
}

export function RecordEditDrawer({
  isOpen,
  record,
  workspaceId,
  session,
  config,
  onClose,
  onSaved,
}: RecordEditDrawerProps) {
  const [detail, setDetail] = useState<RecordDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!isOpen || !record) {
      return;
    }

    let cancelled = false;
    const cachedDetail = getCachedRecordDetails(workspaceId, record.id);

    if (cachedDetail) {
      setDetail(cachedDetail);
      setLoading(false);
      setRefreshing(true);
    } else {
      setDetail(null);
      setLoading(true);
      setRefreshing(false);
    }

    setError(null);

    void getRecordDetails(session, workspaceId, record.id)
      .then((nextDetail) => {
        if (cancelled) {
          return;
        }

        setDetail(nextDetail);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }

        const message = nextError instanceof Error ? nextError.message : 'Unable to load this record.';
        setError(message);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, record, session, workspaceId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  async function handleSubmit(payload: RecordSaveInput) {
    if (!record) {
      return;
    }

    try {
      const nextDetail = await updateRecord(session, record.id, payload);
      setDetail(nextDetail);
      onSaved(nextDetail);
      toast.success('Record updated.');
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'Unable to update record.';
      toast.error(message);
      throw nextError;
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 transition ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Close record editor"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/70 transition duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      />

      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-4xl flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl transition duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-edit-drawer-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-200">Record editor</div>
            <h2 id="record-edit-drawer-title" className="mt-2 truncate font-display text-2xl text-white">
              {record?.title ?? 'Edit record'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Update shared lead details and workspace-specific fields without leaving the records queue.
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

        {refreshing ? (
          <div className="border-b border-white/10 px-5 py-3 text-sm text-slate-400 sm:px-6">
            Refreshing the latest record details...
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.03] text-slate-300">
              <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
              Loading record details...
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {error ? (
                <div className="rounded-[28px] border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}
              <RecordForm
                key={detail.record.id}
                workspaceId={workspaceId}
                config={config}
                initialRecord={detail.record}
                initialCustom={detail.custom}
                submitLabel="Save changes"
                onSubmit={handleSubmit}
              />
            </div>
          ) : error ? (
            <div className="rounded-[28px] border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
              {error}
            </div>
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-400">
              Select a record to edit.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
