import { AlertTriangle } from 'lucide-react';

export function ConfigurationNotice() {
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Supabase env vars are not configured yet.</p>
          <p className="mt-1 text-amber-100/80">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable sign
            in, sign up, and dashboard routing.
          </p>
        </div>
      </div>
    </div>
  );
}
