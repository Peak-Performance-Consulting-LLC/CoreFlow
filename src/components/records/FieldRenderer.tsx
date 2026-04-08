import { cn } from '../../lib/utils';
import type { CustomFieldDefinition } from '../../lib/crm-types';

interface FieldRendererProps {
  definition: CustomFieldDefinition;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}

function normalizeOptions(definition: CustomFieldDefinition) {
  return Array.isArray(definition.options) ? definition.options : [];
}

function FieldLabel({ definition }: { definition: CustomFieldDefinition }) {
  return (
    <span className="flex items-center gap-2 font-medium">
      <span>{definition.label}</span>
      {definition.is_required ? (
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-cyan-200">
          Required
        </span>
      ) : null}
    </span>
  );
}

export function FieldRenderer({ definition, value, error, onChange }: FieldRendererProps) {
  const options = normalizeOptions(definition);

  if (definition.field_type === 'textarea') {
    return (
      <label className="flex w-full flex-col gap-2 text-sm text-slate-200">
        <FieldLabel definition={definition} />
        <textarea
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={definition.placeholder ?? ''}
          className={cn(
            'rounded-2xl border bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition',
            error
              ? 'border-rose-400/60'
              : 'border-white/10 focus:border-cyan-300/60 focus:bg-slate-950/90',
          )}
        />
        {error ? <span className="text-xs text-rose-300">{error}</span> : null}
        {!error && definition.help_text ? <span className="text-xs text-slate-500">{definition.help_text}</span> : null}
      </label>
    );
  }

  if (definition.field_type === 'boolean') {
    return (
      <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
        <div>
          <FieldLabel definition={definition} />
          {definition.help_text ? <div className="mt-1 text-xs text-slate-500">{definition.help_text}</div> : null}
        </div>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300 focus:ring-cyan-300"
        />
      </label>
    );
  }

  if (definition.field_type === 'select') {
    return (
      <label className="flex w-full flex-col gap-2 text-sm text-slate-200">
        <FieldLabel definition={definition} />
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || null)}
          className={cn(
            'h-12 rounded-2xl border bg-slate-950/70 px-4 text-sm text-white transition',
            error
              ? 'border-rose-400/60'
              : 'border-white/10 focus:border-cyan-300/60 focus:bg-slate-950/90',
          )}
        >
          <option value="">Select {definition.label}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {error ? <span className="text-xs text-rose-300">{error}</span> : null}
        {!error && options.length > 0 ? <span className="text-xs text-slate-500">{options.length} preset options</span> : null}
      </label>
    );
  }

  if (definition.field_type === 'multi_select') {
    const selected = Array.isArray(value) ? value.map((item) => String(item)) : [];

    return (
      <div className="space-y-3">
        <div>
          <div className="text-sm text-slate-200">
            <FieldLabel definition={definition} />
          </div>
          {definition.help_text ? <div className="mt-1 text-xs text-slate-500">{definition.help_text}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onChange(
                    isSelected ? selected.filter((item) => item !== option) : [...selected, option],
                  )
                }
                className={cn(
                  'rounded-full border px-3 py-2 text-sm transition',
                  isSelected
                    ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white',
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
        {error ? <span className="text-xs text-rose-300">{error}</span> : null}
      </div>
    );
  }

  return (
    <label className="flex w-full flex-col gap-2 text-sm text-slate-200">
      <FieldLabel definition={definition} />
      <input
        type={definition.field_type === 'number' ? 'number' : definition.field_type === 'date' ? 'date' : 'text'}
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={definition.placeholder ?? ''}
        className={cn(
          'h-12 rounded-2xl border bg-slate-950/70 px-4 text-sm text-white placeholder:text-slate-500 transition',
          error
            ? 'border-rose-400/60'
            : 'border-white/10 focus:border-cyan-300/60 focus:bg-slate-950/90',
        )}
      />
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
      {!error && definition.help_text ? <span className="text-xs text-slate-500">{definition.help_text}</span> : null}
    </label>
  );
}
