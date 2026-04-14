import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  createEdgeClients,
  resolveWorkspaceVoiceActorUserId,
  type EdgeClient,
} from '../_shared/server.ts';
import {
  answerCall,
  hangupCall,
  startGatherUsingAi,
  startNoiseSuppression,
  startRecording,
  startAIAssistant,
  TelnyxApiError,
} from '../_shared/telnyx-client.ts';
import {
  assertVerifiedTelnyxWebhook,
} from '../_shared/telnyx-signature.ts';
import {
  isPhase1HandledEvent,
  parseTelnyxWebhook,
} from '../_shared/telnyx-normalize.ts';
import {
  applyCallAnswered,
  applyCallGathering,
  applyCallHangup,
  applyGatherEnded,
  beginEventProcessing,
  findVoiceCallById,
  findWorkspacePhoneNumberById,
  findWorkspacePhoneNumberByE164,
  linkEventToVoiceCall,
  markWorkspacePhoneNumberWebhookObserved,
  markEventFailed,
  markEventIgnored,
  markEventProcessed,
  setVoiceCallRuntimeMode,
  updateVoiceCallAssistantContext,
  upsertVoiceCallBase,
} from '../_shared/voice-repository.ts';
import {
  buildVoiceAgentCallSnapshot,
} from '../_shared/voice-agent-mapper.ts';
import {
  getVoiceAgentRuntimeByPhoneNumberId,
  type VoiceAgentRuntimeConfig,
  type VoiceAgentRow,
} from '../_shared/voice-agent-repository.ts';
import { finalizeVoiceCallOutcome } from '../_shared/voice-outcome-finalizer.ts';
import { enqueueVoiceActionRunsForOutcome } from '../_shared/voice-action-repository.ts';
import { runVoiceAction } from '../_shared/voice-action-runner.ts';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const DEFAULT_ASSISTANT_LANGUAGE = 'en';
const DEFAULT_ASSISTANT_TRANSCRIPTION_MODEL = 'deepgram/nova-3';
const ENABLE_NOISE_SUPPRESSION = parseBooleanEnv('TELNYX_ENABLE_NOISE_SUPPRESSION', false);
const USE_ASSISTANT_OVERRIDES = parseBooleanEnv('TELNYX_USE_ASSISTANT_OVERRIDES', false);
const ENABLE_RECORDING = parseBooleanEnv('TELNYX_ENABLE_RECORDING', false);
const RECORDING_CHANNELS = parseRecordingChannelsEnv('TELNYX_RECORDING_CHANNELS', 'dual');
const E164_REGEX = /^\+[1-9][0-9]{1,14}$/;
const FORCE_TRANSCRIPTION_OVERRIDE = parseBooleanEnv('TELNYX_FORCE_TRANSCRIPTION_OVERRIDE', false);
const ASSISTANT_START_DELAY_MS = parseIntEnv('TELNYX_ASSISTANT_START_DELAY_MS', 1200);

function ensureNonEmpty(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isE164(value: string | null | undefined) {
  const normalized = ensureNonEmpty(value);
  return Boolean(normalized && E164_REGEX.test(normalized));
}

function parseBooleanEnv(name: string, fallback: boolean) {
  const raw = Deno.env.get(name)?.trim().toLowerCase();

  if (!raw) {
    return fallback;
  }

  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') {
    return true;
  }

  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') {
    return false;
  }

  return fallback;
}

function parseIntEnv(name: string, fallback: number) {
  const raw = Deno.env.get(name)?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function parseRecordingChannelsEnv(name: string, fallback: 'single' | 'dual') {
  const raw = Deno.env.get(name)?.trim().toLowerCase();
  return raw === 'single' || raw === 'dual' ? raw : fallback;
}

function normalizeGatherVoice(value: string | null | undefined) {
  const normalized = ensureNonEmpty(value);

  if (!normalized) {
    return null;
  }

  if (normalized.includes('.')) {
    return normalized;
  }

  return `Telnyx.KokoroTTS.${normalized}`;
}

function normalizeGatherLanguage(value: string | null | undefined) {
  const normalized = ensureNonEmpty(value)?.toLowerCase().replace('_', '-');

  if (!normalized) {
    return null;
  }

  const [base] = normalized.split('-');

  if (base && /^[a-z]{2,3}$/.test(base)) {
    return base;
  }

  return normalized;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function commandId(action: 'answer' | 'assistant_start' | 'gather_start' | 'hangup', callControlId: string) {
  return `coreflow:voice:${action}:v1:${callControlId}`;
}

function suppressionCommandId(callControlId: string) {
  return `coreflow:voice:suppression:v1:${callControlId}`;
}

function recordingCommandId(callControlId: string) {
  return `coreflow:voice:recording:v1:${callControlId}`;
}

function buildClientState(workspaceId: string, voiceCallId: string) {
  return btoa(JSON.stringify({ workspaceId, voiceCallId }));
}

function resolveAssistantId(agent?: Pick<VoiceAgentRow, 'telnyx_assistant_id'> | null) {
  const fromAgent = ensureNonEmpty(agent?.telnyx_assistant_id);
  const fromEnv = ensureNonEmpty(Deno.env.get('TELNYX_ASSISTANT_ID'));
  const candidate = fromAgent ?? fromEnv;

  if (!candidate) {
    return null;
  }

  // Accept Telnyx UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  // or the legacy `assistant-` prefixed ID format.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate);
  const isAssistantPrefixed = /^assistant-[a-zA-Z0-9-]{8,}$/.test(candidate);

  return isUuid || isAssistantPrefixed ? candidate : null;
}

function buildAssistantStartOverrides(
  agent?: Pick<VoiceAgentRow, 'greeting' | 'telnyx_language' | 'telnyx_voice' | 'telnyx_transcription_model'>,
) {
  if (!agent) {
    return undefined;
  }

  const greeting = ensureNonEmpty(agent.greeting);
  const language = normalizeGatherLanguage(agent.telnyx_language);
  const voice = normalizeGatherVoice(agent.telnyx_voice);
  const transcriptionModel = ensureNonEmpty(agent.telnyx_transcription_model);
  const overrides: Record<string, unknown> = {};

  if (greeting) {
    overrides.greeting = greeting;
  }

  if (voice) {
    overrides.voice = voice;
  }

  if (transcriptionModel || language) {
    const transcription: Record<string, unknown> = {};

    if (transcriptionModel) {
      transcription.model = transcriptionModel;
    }

    if (language) {
      transcription.language = language;
    }

    if (Object.keys(transcription).length > 0) {
      overrides.transcription = transcription;
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

function buildForcedTranscriptionOverride(
  agent?: Pick<VoiceAgentRow, 'telnyx_language' | 'telnyx_transcription_model'>,
) {
  if (!FORCE_TRANSCRIPTION_OVERRIDE) {
    return undefined;
  }

  const model = ensureNonEmpty(agent?.telnyx_transcription_model) ??
    ensureNonEmpty(Deno.env.get('TELNYX_ASSISTANT_TRANSCRIPTION_MODEL')) ??
    DEFAULT_ASSISTANT_TRANSCRIPTION_MODEL;
  const language = normalizeGatherLanguage(agent?.telnyx_language) ??
    normalizeGatherLanguage(Deno.env.get('TELNYX_ASSISTANT_LANGUAGE')) ??
    DEFAULT_ASSISTANT_LANGUAGE;

  return {
    transcription: {
      model,
      language,
    },
  } as Record<string, unknown>;
}

function mergeAssistantOverrides(...parts: Array<Record<string, unknown> | undefined>) {
  const merged: Record<string, unknown> = {};

  for (const part of parts) {
    if (!part) {
      continue;
    }

    for (const [key, value] of Object.entries(part)) {
      if (key === 'transcription' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const existing = merged.transcription;
        const current = (typeof existing === 'object' && existing !== null && !Array.isArray(existing))
          ? existing as Record<string, unknown>
          : {};
        merged.transcription = { ...current, ...(value as Record<string, unknown>) };
        continue;
      }

      merged[key] = value;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error.';
}

function isTelnyxInvalidRequestError(error: unknown): error is TelnyxApiError {
  if (!(error instanceof TelnyxApiError)) {
    return false;
  }

  return error.status === 400 || error.status === 422;
}

function formatTelnyxResponseBody(error: unknown) {
  if (!(error instanceof TelnyxApiError)) {
    return null;
  }

  try {
    return JSON.stringify(error.responseBody);
  } catch {
    return null;
  }
}

function buildGatherSchemaFromMappings(mappings: VoiceAgentRuntimeConfig['mappings'] | undefined) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const safeMappings = Array.isArray(mappings) ? mappings : [];

  for (const mapping of safeMappings) {
    const sourceKey = ensureNonEmpty(mapping?.source_key);

    if (!sourceKey || properties[sourceKey]) {
      continue;
    }

    const valueType = ensureNonEmpty(mapping?.source_value_type)?.toLowerCase();
    const type = valueType === 'number' || valueType === 'boolean' || valueType === 'array' ? valueType : 'string';
    const description = ensureNonEmpty(mapping?.source_description) ?? ensureNonEmpty(mapping?.source_label) ?? sourceKey;
    properties[sourceKey] = {
      type,
      description,
    };

    if (mapping?.is_required) {
      required.push(sourceKey);
    }
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  } as Record<string, unknown>;
}

function isTelnyxCallAlreadyEndedError(error: unknown) {
  if (!(error instanceof TelnyxApiError) || error.status !== 422) {
    return false;
  }

  const responseBody = error.responseBody;

  if (typeof responseBody !== 'object' || responseBody === null || !('errors' in responseBody)) {
    return false;
  }

  const errors = (responseBody as { errors?: unknown }).errors;

  if (!Array.isArray(errors)) {
    return false;
  }

  return errors.some((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return false;
    }

    const code = typeof entry.code === 'string' ? entry.code : '';
    const title = typeof entry.title === 'string' ? entry.title.toLowerCase() : '';
    const detail = typeof entry.detail === 'string' ? entry.detail.toLowerCase() : '';

    return code === '90018' || title.includes('call has already ended') || detail.includes("can't receive commands");
  });
}

function isRetryableInternalError(error: unknown) {
  if (error instanceof TelnyxApiError) {
    if (error.status >= 500 || error.status === 408 || error.status === 429) {
      return true;
    }

    return false;
  }

  if (!(error instanceof Error)) {
    return true;
  }

  if (error.name.includes('Signature')) {
    return false;
  }

  if (error.name.includes('Validation')) {
    return false;
  }

  return true;
}

function toJsonValue(value: unknown): JsonValue | null {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return null;
  }
}

function summarizeMessageHistory(messageHistory: unknown[] | null) {
  const summary = {
    total: 0,
    assistant: 0,
    user: 0,
    other: 0,
  };

  if (!Array.isArray(messageHistory)) {
    return summary;
  }

  for (const entry of messageHistory) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      summary.other += 1;
      continue;
    }

    summary.total += 1;
    const role = typeof entry.role === 'string' ? entry.role.trim().toLowerCase() : '';

    if (role === 'assistant') {
      summary.assistant += 1;
      continue;
    }

    if (role === 'user') {
      summary.user += 1;
      continue;
    }

    summary.other += 1;
  }

  return summary;
}

async function findExistingVoiceCallByControlId(
  db: EdgeClient,
  workspaceId: string,
  callControlId: string,
) {
  const { data, error } = await db
    .from('voice_calls')
    .select('id, from_number_e164, lead_creation_status')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'telnyx')
    .eq('provider_call_control_id', callControlId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as { id: string; from_number_e164: string; lead_creation_status: string } | null;
}

async function findExistingVoiceCallByControlIdGlobal(
  db: EdgeClient,
  callControlId: string,
) {
  const { data, error } = await db
    .from('voice_calls')
    .select('id, workspace_id, workspace_phone_number_id, from_number_e164, to_number_e164, lead_creation_status')
    .eq('provider', 'telnyx')
    .eq('provider_call_control_id', callControlId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    id: string;
    workspace_id: string;
    workspace_phone_number_id: string;
    from_number_e164: string;
    to_number_e164: string;
    lead_creation_status: string;
  } | null;
}

async function finalizeAndTriggerActions(params: {
  db: EdgeClient;
  workspaceId: string;
  voiceCallId: string;
  outcomeStatus: 'lead_created' | 'crm_failed' | 'gather_incomplete' | 'mapping_failed' | 'ended_without_lead' | 'review_needed';
  outcomeReason?: string | null;
  outcomeError?: string | null;
}) {
  const call = await finalizeVoiceCallOutcome({
    db: params.db,
    workspaceId: params.workspaceId,
    voiceCallId: params.voiceCallId,
    outcomeStatus: params.outcomeStatus,
    outcomeReason: params.outcomeReason,
    outcomeError: params.outcomeError,
  });
  const runs = await enqueueVoiceActionRunsForOutcome({
    db: params.db,
    call,
    outcomeStatus: call.outcome_status ?? params.outcomeStatus,
    outcomeReason: call.outcome_reason,
    outcomeError: call.outcome_error,
  });

  if (runs.length > 0) {
    const actorUserId = await resolveWorkspaceVoiceActorUserId(params.db, params.workspaceId);

    for (const run of runs) {
      await runVoiceAction({
        db: params.db,
        workspaceId: params.workspaceId,
        actionRunId: run.id,
        actorUserId,
      });
    }
  }

  return findVoiceCallById(params.db, params.workspaceId, params.voiceCallId);
}

async function startInboundNoiseSuppressionForCall(params: {
  workspaceId: string;
  voiceCallId: string;
  callControlId: string;
}) {
  if (!ENABLE_NOISE_SUPPRESSION) {
    console.log('[telnyx-voice-webhook] noise suppression skipped (disabled)', {
      workspaceId: params.workspaceId,
      voiceCallId: params.voiceCallId,
      callControlId: params.callControlId,
    });
    return;
  }

  try {
    const suppressionResult = await startNoiseSuppression({
      callControlId: params.callControlId,
      commandId: suppressionCommandId(params.callControlId),
      clientState: buildClientState(params.workspaceId, params.voiceCallId),
      direction: 'inbound',
    });
    console.log('[telnyx-voice-webhook] noise suppression started', {
      workspaceId: params.workspaceId,
      voiceCallId: params.voiceCallId,
      callControlId: params.callControlId,
      commandId: suppressionResult.commandId,
      status: suppressionResult.status,
    });
  } catch (error) {
    console.warn('[telnyx-voice-webhook] noise suppression start failed', {
      workspaceId: params.workspaceId,
      voiceCallId: params.voiceCallId,
      callControlId: params.callControlId,
      message: safeErrorMessage(error),
    });
  }
}

async function startAssistantWithFallback(params: {
  workspaceId: string;
  voiceCallId: string;
  callControlId: string;
  assistantId: string;
  assistantOverrides?: Record<string, unknown>;
}) {
  const attempts: Array<{
    label: string;
    assistantOverrides?: Record<string, unknown>;
    sendMessageHistoryUpdates?: boolean;
  }> = [
    {
      label: 'primary',
      assistantOverrides: params.assistantOverrides,
      sendMessageHistoryUpdates: true,
    },
    {
      label: 'no_overrides',
      assistantOverrides: undefined,
      sendMessageHistoryUpdates: true,
    },
    {
      // Minimal: bare ai_assistant_id only — no overrides, no extra fields.
      label: 'minimal',
      assistantOverrides: undefined,
      sendMessageHistoryUpdates: undefined,
    },
  ];
  let lastError: unknown = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];

    if (!attempt) {
      continue;
    }

    try {
      if (index > 0) {
        await sleep(500);
      }

      const result = await startAIAssistant({
        callControlId: params.callControlId,
        commandId: commandId('assistant_start', params.callControlId),
        clientState: buildClientState(params.workspaceId, params.voiceCallId),
        assistantId: params.assistantId,
        assistantOverrides: attempt.assistantOverrides,
        ...(typeof attempt.sendMessageHistoryUpdates === 'boolean'
          ? { sendMessageHistoryUpdates: attempt.sendMessageHistoryUpdates }
          : {}),
      });

      return {
        attemptLabel: attempt.label,
        result,
      };
    } catch (error) {
      lastError = error;

      if (!isTelnyxInvalidRequestError(error)) {
        throw error;
      }

      console.warn('[telnyx-voice-webhook] assistant start attempt failed (invalid request)', {
        workspaceId: params.workspaceId,
        voiceCallId: params.voiceCallId,
        callControlId: params.callControlId,
        attempt: attempt.label,
        status: error.status,
        responseBody: formatTelnyxResponseBody(error),
      });
    }
  }

  throw lastError ?? new Error('Assistant start failed.');
}

async function startGatherFallback(params: {
  workspaceId: string;
  voiceCallId: string;
  callControlId: string;
  runtimeConfig: VoiceAgentRuntimeConfig | null;
}) {
  const greeting = ensureNonEmpty(params.runtimeConfig?.agent?.greeting);
  const model = ensureNonEmpty(params.runtimeConfig?.agent?.telnyx_model);
  const instructions = ensureNonEmpty(params.runtimeConfig?.agent?.system_prompt);
  const voice = normalizeGatherVoice(params.runtimeConfig?.agent?.telnyx_voice);
  const language = normalizeGatherLanguage(params.runtimeConfig?.agent?.telnyx_language);
  const transcriptionModel = ensureNonEmpty(params.runtimeConfig?.agent?.telnyx_transcription_model);
  const parametersSchema = buildGatherSchemaFromMappings(params.runtimeConfig?.mappings);

  const gatherResult = await startGatherUsingAi({
    callControlId: params.callControlId,
    commandId: commandId('gather_start', params.callControlId),
    clientState: buildClientState(params.workspaceId, params.voiceCallId),
    ...(greeting ? { greeting } : {}),
    parametersSchema,
    ...(model || instructions
      ? {
        assistant: {
          ...(model ? { model } : {}),
          ...(instructions ? { instructions } : {}),
        },
      }
      : {}),
    ...(voice ? { voice } : {}),
    ...(language ? { language } : {}),
    ...((transcriptionModel || language)
      ? {
        transcription: {
          ...(transcriptionModel ? { model: transcriptionModel } : {}),
          ...(language ? { language } : {}),
        },
      }
      : {}),
    sendMessageHistoryUpdates: true,
  });

  console.log('[telnyx-voice-webhook] gather_using_ai fallback started', {
    workspaceId: params.workspaceId,
    voiceCallId: params.voiceCallId,
    callControlId: params.callControlId,
    commandId: gatherResult.commandId,
    status: gatherResult.status,
  });

  return gatherResult;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const clients = createEdgeClients(request);

  if ('errorResponse' in clients) {
    return clients.errorResponse;
  }

  const db = clients.serviceClient;

  let normalizedEvent: ReturnType<typeof parseTelnyxWebhook> | null = null;
  let workspaceId: string | null = null;
  let eventId: string | null = null;

  try {
    const verified = await assertVerifiedTelnyxWebhook(request, {
      TELNYX_PUBLIC_KEY: Deno.env.get('TELNYX_PUBLIC_KEY'),
      TELNYX_SIGNATURE_MAX_SKEW_SECONDS: Deno.env.get('TELNYX_SIGNATURE_MAX_SKEW_SECONDS'),
    });

    let rawJson: unknown;

    try {
      rawJson = JSON.parse(verified.rawBodyText);
    } catch {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'invalid_json_payload',
      }, 200);
    }

    try {
      normalizedEvent = parseTelnyxWebhook(rawJson);
    } catch {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'malformed_webhook_payload',
      }, 200);
    }

    console.log('[telnyx-voice-webhook] received event', {
      eventType: normalizedEvent.eventType,
      providerEventId: normalizedEvent.providerEventId,
      occurredAt: normalizedEvent.occurredAt,
      callControlId: normalizedEvent.callControlId,
      callSessionId: normalizedEvent.callSessionId,
      fromNumber: normalizedEvent.fromNumberE164,
      toNumber: normalizedEvent.toNumberE164,
    });

    if (!isPhase1HandledEvent(normalizedEvent.eventType)) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'unhandled_event_type',
        event_type: normalizedEvent.eventType,
      }, 200);
    }

    const callControlId = ensureNonEmpty(normalizedEvent.callControlId);

    if (!callControlId) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'missing_call_control_id',
      }, 200);
    }

    const toNumberCandidate = ensureNonEmpty(normalizedEvent.toNumberE164);
    const toNumber = isE164(toNumberCandidate) ? toNumberCandidate : null;
    let workspacePhoneNumber = toNumber ? await findWorkspacePhoneNumberByE164(db, toNumber) : null;
    let existingCallGlobal: Awaited<ReturnType<typeof findExistingVoiceCallByControlIdGlobal>> = null;

    if (!workspacePhoneNumber) {
      existingCallGlobal = await findExistingVoiceCallByControlIdGlobal(db, callControlId);

      if (existingCallGlobal) {
        const existingWorkspaceId = ensureNonEmpty(existingCallGlobal.workspace_id);
        const existingWorkspacePhoneNumberId = ensureNonEmpty(existingCallGlobal.workspace_phone_number_id);

        if (existingWorkspaceId && existingWorkspacePhoneNumberId) {
          try {
            workspacePhoneNumber = await findWorkspacePhoneNumberById(
              db,
              existingWorkspaceId,
              existingWorkspacePhoneNumberId,
            );
          } catch {
            workspacePhoneNumber = null;
          }
        }
      }
    }

    if (!workspacePhoneNumber) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: toNumberCandidate ? 'unknown_phone_number' : 'missing_or_non_e164_to_number',
      }, 200);
    }

    const resolvedWorkspaceId = ensureNonEmpty(workspacePhoneNumber.workspace_id);

    if (!resolvedWorkspaceId) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'workspace_phone_number_missing_workspace_id',
      }, 200);
    }

    workspaceId = resolvedWorkspaceId;
    const resolvedToNumber = toNumber ?? ensureNonEmpty(existingCallGlobal?.to_number_e164);

    if (!resolvedToNumber || !isE164(resolvedToNumber)) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'unable_to_resolve_e164_to_number',
      }, 200);
    }

    await markWorkspacePhoneNumberWebhookObserved(db, {
      workspaceId,
      voiceNumberId: workspacePhoneNumber.id,
      observedAt: normalizedEvent.occurredAt,
    });

    const providerEventId = ensureNonEmpty(normalizedEvent.providerEventId);
    const occurredAt = ensureNonEmpty(normalizedEvent.occurredAt);

    if (!providerEventId || !occurredAt || !callControlId) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'missing_required_event_fields',
      }, 200);
    }

    const eventGate = await beginEventProcessing(db, {
      workspaceId,
      providerEventId,
      eventType: normalizedEvent.eventType,
      occurredAt,
      payload: normalizedEvent.rawPayload,
      signatureValid: true,
      provider: 'telnyx',
    });

    eventId = eventGate.event.id;

    if (!eventGate.shouldProcess) {
      return jsonResponse({
        ok: true,
        duplicate: true,
        reason: 'event_already_processed',
      }, 200);
    }

    const initialStatus = normalizedEvent.eventType === 'call.initiated'
      ? 'initiated'
      : normalizedEvent.eventType === 'call.answered'
        ? 'answered'
        : normalizedEvent.eventType === 'call.conversation.ended'
          ? 'gathering'
          : 'ended';

    const existingCall = await findExistingVoiceCallByControlId(db, workspaceId, callControlId);
    const fromNumber = ensureNonEmpty(normalizedEvent.fromNumberE164) ?? existingCall?.from_number_e164 ?? null;

    if (!fromNumber) {
      await markEventFailed(db, {
        workspaceId,
        eventId,
        errorMessage: 'Missing from_number_e164 for call upsert.',
      });

      return jsonResponse({
        ok: true,
        failed: true,
        reason: 'missing_from_number_e164_for_call_upsert',
      }, 200);
    }

    const call = await upsertVoiceCallBase(db, {
      workspaceId,
      workspacePhoneNumberId: workspacePhoneNumber.id,
      provider: 'telnyx',
      direction: 'inbound',
      providerCallControlId: callControlId,
      providerCallLegId: normalizedEvent.callLegId,
      providerCallSessionId: normalizedEvent.callSessionId,
      providerConnectionId: normalizedEvent.connectionId,
      fromNumberE164: fromNumber,
      toNumberE164: resolvedToNumber,
      status: initialStatus,
    });

    await linkEventToVoiceCall(db, {
      workspaceId,
      eventId,
      voiceCallId: call.id,
    });

    if (normalizedEvent.eventType === 'call.initiated') {
      console.log('[telnyx-voice-webhook] about to answer call', {
        workspaceId,
        eventId,
        voiceCallId: call.id,
        callControlId: call.provider_call_control_id,
        toNumber: resolvedToNumber,
      });
      await answerCall({
        callControlId: call.provider_call_control_id,
        commandId: commandId('answer', call.provider_call_control_id),
        clientState: buildClientState(workspaceId, call.id),
      });
      await markEventProcessed(db, { workspaceId, eventId });
      return jsonResponse({ ok: true, handled: normalizedEvent.eventType }, 200);
    }

    if (normalizedEvent.eventType === 'call.answered') {
      await applyCallAnswered(db, {
        workspaceId,
        voiceCallId: call.id,
        answeredAt: occurredAt,
      });

      const runtimeConfig = await getVoiceAgentRuntimeByPhoneNumberId(
        db,
        workspaceId,
        workspacePhoneNumber.id,
      );
      const assistantId = resolveAssistantId(runtimeConfig?.agent);

      await setVoiceCallRuntimeMode(db, {
        workspaceId,
        voiceCallId: call.id,
        runtimeMode: 'assistant',
      });

      if (runtimeConfig) {
        const snapshot = buildVoiceAgentCallSnapshot(runtimeConfig);
        await updateVoiceCallAssistantContext(db, {
          workspaceId,
          voiceCallId: call.id,
          voiceAgentId: runtimeConfig.agent.id,
          voiceAgentBindingId: runtimeConfig.binding.id,
          assistantMappingSnapshot: snapshot,
        });
      } else {
        await updateVoiceCallAssistantContext(db, {
          workspaceId,
          voiceCallId: call.id,
          voiceAgentId: null,
          voiceAgentBindingId: null,
          assistantMappingSnapshot: null,
        });
      }

      if (ENABLE_RECORDING) {
        try {
          const recordingResult = await startRecording({
            callControlId: call.provider_call_control_id,
            commandId: recordingCommandId(call.provider_call_control_id),
            clientState: buildClientState(workspaceId, call.id),
            format: 'wav',
            channels: RECORDING_CHANNELS,
            playBeep: false,
          });
          console.log('[telnyx-voice-webhook] recording started', {
            workspaceId,
            voiceCallId: call.id,
            callControlId: call.provider_call_control_id,
            commandId: recordingResult.commandId,
            status: recordingResult.status,
          });
        } catch (error) {
          console.warn('[telnyx-voice-webhook] recording start failed', {
            workspaceId,
            voiceCallId: call.id,
            callControlId: call.provider_call_control_id,
            message: safeErrorMessage(error),
          });
        }
      } else {
        console.log('[telnyx-voice-webhook] recording skipped (disabled)', {
          workspaceId,
          voiceCallId: call.id,
          callControlId: call.provider_call_control_id,
        });
      }

      await startInboundNoiseSuppressionForCall({
        workspaceId,
        voiceCallId: call.id,
        callControlId: call.provider_call_control_id,
      });

      if (!assistantId) {
        console.warn('[telnyx-voice-webhook] assistant id missing/invalid, using gather fallback', {
          workspaceId,
          voiceCallId: call.id,
          callControlId: call.provider_call_control_id,
          runtimeVoiceAgentId: runtimeConfig?.agent.id ?? null,
          configuredAssistantId: runtimeConfig?.agent.telnyx_assistant_id ?? null,
          envAssistantId: ensureNonEmpty(Deno.env.get('TELNYX_ASSISTANT_ID')) ?? null,
        });

        await startGatherFallback({
          workspaceId,
          voiceCallId: call.id,
          callControlId: call.provider_call_control_id,
          runtimeConfig,
        });

        await applyCallGathering(db, {
          workspaceId,
          voiceCallId: call.id,
        });

        await markEventProcessed(db, { workspaceId, eventId });
        return jsonResponse({
          ok: true,
          handled: normalizedEvent.eventType,
          mode: 'gather_fallback',
          reason: 'missing_or_invalid_telnyx_assistant_id',
        }, 200);
      }

      if (ASSISTANT_START_DELAY_MS > 0) {
        await sleep(ASSISTANT_START_DELAY_MS);
      }

      const assistantOverrides = mergeAssistantOverrides(
        USE_ASSISTANT_OVERRIDES ? buildAssistantStartOverrides(runtimeConfig?.agent) : undefined,
        buildForcedTranscriptionOverride(runtimeConfig?.agent),
      );

      try {
        const assistantStart = await startAssistantWithFallback({
          workspaceId,
          voiceCallId: call.id,
          callControlId: call.provider_call_control_id,
          assistantId,
          assistantOverrides,
        });
        console.log('[telnyx-voice-webhook] assistant started', {
          workspaceId,
          voiceCallId: call.id,
          callControlId: call.provider_call_control_id,
          runtimeMode: 'assistant',
          assistantId,
          assistantStartAttempt: assistantStart.attemptLabel,
          assistantOverridesEnabled: USE_ASSISTANT_OVERRIDES,
          forcedTranscriptionOverrideEnabled: FORCE_TRANSCRIPTION_OVERRIDE,
          assistantStartDelayMs: ASSISTANT_START_DELAY_MS,
          commandId: assistantStart.result.commandId,
          status: assistantStart.result.status,
        });
      } catch (assistantStartError) {
        if (!isTelnyxInvalidRequestError(assistantStartError)) {
          throw assistantStartError;
        }

        console.warn('[telnyx-voice-webhook] assistant start failed, switching to gather fallback', {
          workspaceId,
          voiceCallId: call.id,
          callControlId: call.provider_call_control_id,
          assistantId,
          status: assistantStartError.status,
          responseBody: formatTelnyxResponseBody(assistantStartError),
        });

        await startGatherFallback({
          workspaceId,
          voiceCallId: call.id,
          callControlId: call.provider_call_control_id,
          runtimeConfig,
        });
      }

      await applyCallGathering(db, {
        workspaceId,
        voiceCallId: call.id,
      });

      await markEventProcessed(db, { workspaceId, eventId });
      return jsonResponse({ ok: true, handled: normalizedEvent.eventType }, 200);
    }

    if (normalizedEvent.eventType === 'call.conversation.ended') {
      const messageSummary = summarizeMessageHistory(normalizedEvent.messageHistory);
      console.log('[telnyx-voice-webhook] assistant conversation ended event received', {
        workspaceId,
        eventType: normalizedEvent.eventType,
        callControlId: normalizedEvent.callControlId,
        messageSummary,
      });

      const gathered = await applyGatherEnded(db, {
        workspaceId,
        voiceCallId: call.id,
        gatherResult: toJsonValue(normalizedEvent.gatherResult),
        messageHistory: toJsonValue(normalizedEvent.messageHistory),
        providerGatherStatus: normalizedEvent.gatherStatus,
        gatherStatus: 'completed',
        gatherCompletedAt: occurredAt,
      });
      await finalizeAndTriggerActions({
        db,
        workspaceId,
        voiceCallId: call.id,
        outcomeStatus: gathered.record_id || gathered.lead_creation_status === 'created' ? 'lead_created' : 'review_needed',
        outcomeReason: gathered.record_id || gathered.lead_creation_status === 'created'
          ? 'lead_created'
          : 'assistant_conversation_ended',
      });

      try {
        await hangupCall({
          callControlId: call.provider_call_control_id,
          commandId: commandId('hangup', call.provider_call_control_id),
        });
      } catch (error) {
        if (isTelnyxCallAlreadyEndedError(error)) {
          console.warn('[telnyx-voice-webhook] hangup skipped because call already ended', {
            workspaceId,
            voiceCallId: call.id,
            callControlId: call.provider_call_control_id,
          });
        } else {
          throw error;
        }
      }

      await markEventProcessed(db, { workspaceId, eventId });
      return jsonResponse({ ok: true, handled: normalizedEvent.eventType }, 200);
    }

    if (normalizedEvent.eventType === 'call.hangup') {
      const hungup = await applyCallHangup(db, {
        workspaceId,
        voiceCallId: call.id,
        endedAt: occurredAt,
      });

      if (!hungup.outcome_status) {
        await finalizeAndTriggerActions({
          db,
          workspaceId,
          voiceCallId: call.id,
          outcomeStatus: hungup.record_id ? 'lead_created' : 'ended_without_lead',
          outcomeReason: hungup.record_id ? 'lead_created' : 'call_hangup_without_lead',
        });
      }

      await markEventProcessed(db, { workspaceId, eventId });
      return jsonResponse({ ok: true, handled: normalizedEvent.eventType }, 200);
    }

    await markEventIgnored(db, {
      workspaceId,
      eventId,
      reason: `Unhandled event type: ${normalizedEvent.eventType}`,
    });

    return jsonResponse({ ok: true, ignored: true, reason: 'unhandled_event_type' }, 200);
  } catch (error) {
    console.error('[telnyx-voice-webhook] fatal error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      telnyxStatus: error instanceof TelnyxApiError ? error.status : null,
      telnyxResponseBody: formatTelnyxResponseBody(error),
      error,
      workspaceId,
      eventId,
      normalizedEventType: normalizedEvent?.eventType ?? null,
    });
    if (error instanceof Error && error.name.includes('Signature')) {
      return jsonResponse({ error: 'Invalid webhook signature.' }, 401);
    }

    if (!isRetryableInternalError(error)) {
      if (workspaceId && eventId) {
        try {
          await markEventFailed(db, {
            workspaceId,
            eventId,
            errorMessage: safeErrorMessage(error),
          });
        } catch {
          // Best effort failure tracking for non-retryable processing errors.
        }
      }

      return jsonResponse({ ok: true, failed: true, reason: safeErrorMessage(error) }, 200);
    }

    if (workspaceId && eventId && isRetryableInternalError(error)) {
      try {
        await markEventFailed(db, {
          workspaceId,
          eventId,
          errorMessage: safeErrorMessage(error),
        });
      } catch {
        // Best effort failure tracking; the original error response still indicates retry.
      }
    }

    return jsonResponse({ error: safeErrorMessage(error) }, 500);
  }
});
