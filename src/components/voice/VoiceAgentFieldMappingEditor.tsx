import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { CustomFieldDefinition } from '../../lib/crm-types';
import type {
  VoiceAgentMappingInput,
  VoiceAgentMappingRecord,
  VoiceAgentSourceValueType,
} from '../../lib/voice-agent-service';

const coreTargetOptions = [
  { value: 'title', label: 'Title' },
  { value: 'full_name', label: 'Full name' },
  { value: 'company_name', label: 'Company name' },
  { value: 'email', label: 'Email' },
];

const sourceValueTypeOptions: Array<{ value: VoiceAgentSourceValueType; label: string }> = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'array', label: 'Array' },
];

function toInputRows(mappings: VoiceAgentMappingRecord[]): VoiceAgentMappingInput[] {
  return mappings.length > 0
    ? mappings.map((mapping) => ({
        source_key: mapping.source_key,
        source_label: mapping.source_label,
        source_description: mapping.source_description,
        source_value_type: mapping.source_value_type,
        target_type: mapping.target_type,
        target_key: mapping.target_key,
        is_required: mapping.is_required,
        position: mapping.position,
      }))
    : [];
}

function createEmptyRow(position: number): VoiceAgentMappingInput {
  return {
    source_key: '',
    source_label: '',
    source_description: '',
    source_value_type: 'string',
    target_type: 'core',
    target_key: 'title',
    is_required: false,
    position,
  };
}

interface VoiceAgentFieldMappingEditorProps {
  mappings: VoiceAgentMappingRecord[];
  customFields: CustomFieldDefinition[];
  saving: boolean;
  onSave: (mappings: VoiceAgentMappingInput[]) => Promise<void> | void;
}

export function VoiceAgentFieldMappingEditor({
  mappings,
  customFields,
  saving,
  onSave,
}: VoiceAgentFieldMappingEditorProps) {
  const [rows, setRows] = useState<VoiceAgentMappingInput[]>(() => toInputRows(mappings));

  useEffect(() => {
    setRows(toInputRows(mappings));
  }, [mappings]);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-white">Collected fields and CRM mapping</h3>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            Define exactly which fields the assistant can collect and where each field is allowed to land in CRM.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setRows((current) => [...current, createEmptyRow(current.length)])}
        >
          Add field
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
          No field mappings yet. Add at least one field before activating an assistant.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((row, index) => (
            <div key={`${row.source_key}-${index}`} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span className="font-medium">Source key</span>
                  <input
                    value={row.source_key}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, source_key: event.target.value } : item
                        ),
                      )}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white"
                    placeholder="service_needed"
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span className="font-medium">Source label</span>
                  <input
                    value={row.source_label}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, source_label: event.target.value } : item
                        ),
                      )}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white"
                    placeholder="Service needed"
                  />
                </label>
              </div>

              <label className="mt-4 flex flex-col gap-2 text-sm text-slate-200">
                <span className="font-medium">Source description</span>
                <textarea
                  value={row.source_description ?? ''}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, source_description: event.target.value } : item
                      ),
                    )}
                  rows={2}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white"
                  placeholder="Explain what the assistant should collect for this field."
                />
              </label>

              <div className="mt-4 grid gap-4 xl:grid-cols-4">
                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span className="font-medium">Value type</span>
                  <select
                    value={row.source_value_type}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, source_value_type: event.target.value as VoiceAgentSourceValueType }
                            : item
                        ),
                      )}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white"
                  >
                    {sourceValueTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span className="font-medium">Target type</span>
                  <select
                    value={row.target_type}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                target_type: event.target.value as 'core' | 'custom',
                                target_key: event.target.value === 'core' ? 'title' : (customFields[0]?.field_key ?? ''),
                              }
                            : item
                        ),
                      )}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white"
                  >
                    <option value="core">Core</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span className="font-medium">Target field</span>
                  <select
                    value={row.target_key}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, target_key: event.target.value } : item
                        ),
                      )}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white"
                  >
                    {row.target_type === 'core'
                      ? coreTargetOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))
                      : customFields.map((field) => (
                          <option key={field.field_key} value={field.field_key}>
                            {field.label}
                          </option>
                        ))}
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={row.is_required}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, is_required: event.target.checked } : item
                        ),
                      )}
                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                  Required field
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setRows((current) => current.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({
                      ...item,
                      position: itemIndex,
                    })))
                  }
                >
                  Remove field
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          loading={saving}
          onClick={() => void onSave(rows.map((row, index) => ({ ...row, position: index })))}
        >
          Save mappings
        </Button>
      </div>
    </Card>
  );
}
