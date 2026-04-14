import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import type { RecordSource } from '../../lib/crm-types';
import type { VoiceAgentRecord, VoiceAgentStatus } from '../../lib/voice-agent-service';

export interface VoiceAgentFormValues {
  name: string;
  description: string;
  greeting: string;
  system_prompt: string;
  telnyx_model: string;
  telnyx_voice: string;
  telnyx_transcription_model: string;
  telnyx_language: string;
  source_id: string;
  status: VoiceAgentStatus;
}

const emptyFormValues: VoiceAgentFormValues = {
  name: '',
  description: '',
  greeting: '',
  system_prompt: '',
  telnyx_model: 'Qwen/Qwen3-235B-A22B',
  telnyx_voice: 'af',
  telnyx_transcription_model: 'deepgram/nova-3',
  telnyx_language: 'en',
  source_id: '',
  status: 'draft',
};

export function createEmptyVoiceAgentFormValues() {
  return { ...emptyFormValues };
}

function toFormValues(agent: VoiceAgentRecord | null | undefined): VoiceAgentFormValues {
  if (!agent) {
    return createEmptyVoiceAgentFormValues();
  }

  const normalizedVoice = agent.telnyx_voice.replace(/^Telnyx\.KokoroTTS\./, '').trim() || 'af';

  return {
    name: agent.name,
    description: agent.description ?? '',
    greeting: agent.greeting,
    system_prompt: agent.system_prompt,
    telnyx_model: agent.telnyx_model,
    telnyx_voice: normalizedVoice,
    telnyx_transcription_model: agent.telnyx_transcription_model,
    telnyx_language: agent.telnyx_language,
    source_id: agent.source_id ?? '',
    status: agent.status,
  };
}

interface VoiceAgentFormProps {
  agent: VoiceAgentRecord | null;
  sources: RecordSource[];
  mode: 'create' | 'edit';
  submitting: boolean;
  errorMessage?: string;
  activationIssues?: string[];
  values?: VoiceAgentFormValues;
  onValuesChange?: (values: VoiceAgentFormValues) => void;
  onSubmit: (values: VoiceAgentFormValues) => Promise<void> | void;
}

export function VoiceAgentForm({
  agent,
  sources,
  mode,
  submitting,
  errorMessage,
  activationIssues = [],
  values: controlledValues,
  onValuesChange,
  onSubmit,
}: VoiceAgentFormProps) {
  const [values, setValues] = useState<VoiceAgentFormValues>(() => toFormValues(agent));
  const isControlled = Boolean(controlledValues && onValuesChange);
  const formValues = controlledValues ?? values;

  function updateValues(next: VoiceAgentFormValues | ((current: VoiceAgentFormValues) => VoiceAgentFormValues)) {
    if (isControlled && controlledValues && onValuesChange) {
      onValuesChange(typeof next === 'function' ? next(controlledValues) : next);
      return;
    }

    setValues(next);
  }

  useEffect(() => {
    if (!isControlled) {
      setValues(toFormValues(agent));
    }
  }, [agent, mode, isControlled]);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-slate-900">{mode === 'create' ? 'New assistant' : 'Assistant setup'}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Configure the greeting, prompt, and CRM source used when this assistant handles inbound calls.
          </p>
        </div>
        {mode === 'edit' && agent ? (
          <div className="rounded-full border border-[#E7DED2] bg-[#FFFDFC] px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-700">
            {agent.status}
          </div>
        ) : null}
      </div>

      <form
        className="mt-6 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(formValues);
        }}
      >
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            <div>{errorMessage}</div>
            {activationIssues.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-rose-100/90">
                {activationIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Input
            label="Assistant name"
            value={formValues.name}
            onChange={(event) => updateValues((current) => ({ ...current, name: event.target.value }))}
            placeholder="Inbound sales intake"
          />

          <label className="flex flex-col gap-2 text-sm text-slate-700">
            <span className="font-medium">Status</span>
            <select
              value={formValues.status}
              onChange={(event) =>
                updateValues((current) => ({ ...current, status: event.target.value as VoiceAgentStatus }))}
              className="h-12 rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] px-4 text-sm text-slate-900"
            >
              <option value="draft">Draft</option>
              {mode === 'edit' ? <option value="active">Active</option> : null}
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm text-slate-700">
          <span className="font-medium">Description</span>
          <textarea
            value={formValues.description}
            onChange={(event) => updateValues((current) => ({ ...current, description: event.target.value }))}
            rows={3}
            className="rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500"
            placeholder="Short note about the assistant's role in this workspace."
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-700">
          <span className="font-medium">Greeting</span>
          <textarea
            value={formValues.greeting}
            onChange={(event) => updateValues((current) => ({ ...current, greeting: event.target.value }))}
            rows={3}
            className="rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500"
            placeholder="Hello, thanks for calling..."
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-700">
          <span className="font-medium">System prompt</span>
          <textarea
            value={formValues.system_prompt}
            onChange={(event) => updateValues((current) => ({ ...current, system_prompt: event.target.value }))}
            rows={6}
            className="rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500"
            placeholder="Describe how the assistant should collect information and stay within scope."
          />
        </label>

        <div className="rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] p-4">
          <div className="text-sm font-medium text-slate-900">Telnyx assistant settings</div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            These values are sent to Telnyx when the assistant is created or updated there.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Input
              label="Telnyx model"
              value={formValues.telnyx_model}
              onChange={(event) => updateValues((current) => ({ ...current, telnyx_model: event.target.value }))}
              placeholder="Qwen/Qwen3-235B-A22B"
            />

            <Input
              label="Telnyx voice"
              value={formValues.telnyx_voice}
              onChange={(event) => updateValues((current) => ({ ...current, telnyx_voice: event.target.value }))}
              placeholder="af"
            />

            <Input
              label="Transcription model"
              value={formValues.telnyx_transcription_model}
              onChange={(event) =>
                updateValues((current) => ({ ...current, telnyx_transcription_model: event.target.value }))}
              placeholder="deepgram/nova-3"
            />

            <Input
              label="Language"
              value={formValues.telnyx_language}
              onChange={(event) => updateValues((current) => ({ ...current, telnyx_language: event.target.value }))}
              placeholder="en"
            />
          </div>
        </div>

        <label className="flex flex-col gap-2 text-sm text-slate-700">
          <span className="font-medium">CRM source</span>
          <select
            value={formValues.source_id}
            onChange={(event) => updateValues((current) => ({ ...current, source_id: event.target.value }))}
            className="h-12 rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] px-4 text-sm text-slate-900"
          >
            <option value="">Use inbound-call fallback</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            {mode === 'create' ? 'Create assistant' : 'Save assistant'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
