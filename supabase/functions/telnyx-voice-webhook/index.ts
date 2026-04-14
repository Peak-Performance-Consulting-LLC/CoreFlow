import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  createEdgeClients,
  resolveWorkspaceVoiceActorUserId,
  type EdgeClient,
} from '../_shared/server.ts';
import {
  answerCall,
  hangupCall,
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
  type VoiceAgentRow,
} from '../_shared/voice-agent-repository.ts';
import { finalizeVoiceCallOutcome } from '../_shared/voice-outcome-finalizer.ts';
import { enqueueVoiceActionRunsForOutcome } from '../_shared/voice-action-repository.ts';
import { runVoiceAction } from '../_shared/voice-action-runner.ts';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const DEFAULT_ASSISTANT_LANGUAGE = 'en';
const DEFAULT_ASSISTANT_VOICE = 'Telnyx.KokoroTTS.af';
const DEFAULT_ASSISTANT_TRANSCRIPTION_MODEL = 'deepgram/nova-3';
const ENABLE_NOISE_SUPPRESSION = parseBooleanEnv('TELNYX_ENABLE_NOISE_SUPPRESSION', false);
const RECORDING_CHANNELS = parseRecordingChannelsEnv('TELNYX_RECORDING_CHANNELS', 'dual');

function ensureNonEmpty(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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

function commandId(action: 'answer' | 'assistant_start' | 'hangup', callControlId: string) {
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
  return ensureNonEmpty(agent?.telnyx_assistant_id) ?? ensureNonEmpty(Deno.env.get('TELNYX_ASSISTANT_ID'));
}

function buildAssistantStartOverrides(
  agent?: Pick<VoiceAgentRow, 'greeting' | 'telnyx_language' | 'telnyx_voice' | 'telnyx_transcription_model'>,
) {
  if (!agent) {
    return undefined;
  }

  const greeting = ensureNonEmpty(agent.greeting);
  const language = normalizeGatherLanguage(agent.telnyx_language) ?? DEFAULT_ASSISTANT_LANGUAGE;
  const voice = normalizeGatherVoice(agent.telnyx_voice) ?? DEFAULT_ASSISTANT_VOICE;
  const transcriptionModel = ensureNonEmpty(agent.telnyx_transcription_model) ?? DEFAULT_ASSISTANT_TRANSCRIPTION_MODEL;

  return {
    ...(greeting ? { greeting } : {}),
    voice,
    ...(transcriptionModel
      ? {
        transcription: {
          model: transcriptionModel,
          language,
        } as Record<string, unknown>,
      }
      : {}),
  };
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error.';
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

    const toNumber = ensureNonEmpty(normalizedEvent.toNumberE164);

    if (!toNumber) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'missing_to_number_e164',
      }, 200);
    }

    const workspacePhoneNumber = await findWorkspacePhoneNumberByE164(db, toNumber);

    if (!workspacePhoneNumber) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'unknown_phone_number',
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
    await markWorkspacePhoneNumberWebhookObserved(db, {
      workspaceId,
      voiceNumberId: workspacePhoneNumber.id,
      observedAt: normalizedEvent.occurredAt,
    });

    const providerEventId = ensureNonEmpty(normalizedEvent.providerEventId);
    const occurredAt = ensureNonEmpty(normalizedEvent.occurredAt);
    const callControlId = ensureNonEmpty(normalizedEvent.callControlId);

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
      toNumberE164: toNumber,
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
        toNumber,
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

      await startInboundNoiseSuppressionForCall({
        workspaceId,
        voiceCallId: call.id,
        callControlId: call.provider_call_control_id,
      });

      if (!assistantId) {
        const errorMessage =
          'Missing Telnyx assistant id. Set voice_agents.telnyx_assistant_id or TELNYX_ASSISTANT_ID for conversational mode.';
        console.error('[telnyx-voice-webhook] assistant start skipped (missing assistant id)', {
          workspaceId,
          voiceCallId: call.id,
          callControlId: call.provider_call_control_id,
          runtimeVoiceAgentId: runtimeConfig?.agent.id ?? null,
        });
        await finalizeAndTriggerActions({
          db,
          workspaceId,
          voiceCallId: call.id,
          outcomeStatus: 'review_needed',
          outcomeReason: 'missing_telnyx_assistant_id',
          outcomeError: errorMessage,
        });
        await markEventFailed(db, { workspaceId, eventId, errorMessage });

        try {
          await hangupCall({
            callControlId: call.provider_call_control_id,
            commandId: commandId('hangup', call.provider_call_control_id),
          });
        } catch (error) {
          if (!isTelnyxCallAlreadyEndedError(error)) {
            throw error;
          }
        }

        return jsonResponse({ ok: true, failed: true, reason: 'missing_telnyx_assistant_id' }, 200);
      }

      const assistantStartResult = await startAIAssistant({
        callControlId: call.provider_call_control_id,
        commandId: commandId('assistant_start', call.provider_call_control_id),
        clientState: buildClientState(workspaceId, call.id),
        assistantId,
        assistantOverrides: buildAssistantStartOverrides(runtimeConfig?.agent),
        sendMessageHistoryUpdates: true,
      });
      console.log('[telnyx-voice-webhook] assistant started', {
        workspaceId,
        voiceCallId: call.id,
        callControlId: call.provider_call_control_id,
        runtimeMode: 'assistant',
        assistantId,
        commandId: assistantStartResult.commandId,
        status: assistantStartResult.status,
      });

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
