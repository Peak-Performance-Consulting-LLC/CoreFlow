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
  startGatherUsingAi,
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
  applyLeadCreated,
  applyLeadFailed,
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
  buildVoiceAgentAssistantPayload,
  buildVoiceAgentCallSnapshot,
  buildVoiceAgentGatherSchema,
} from '../_shared/voice-agent-mapper.ts';
import {
  findActiveVoiceAgentBindingForNumber,
  getVoiceAgentRuntimeByPhoneNumberId,
} from '../_shared/voice-agent-repository.ts';
import { finalizeVoiceCallOutcome } from '../_shared/voice-outcome-finalizer.ts';
import { enqueueVoiceActionRunsForOutcome } from '../_shared/voice-action-repository.ts';
import { runVoiceAction } from '../_shared/voice-action-runner.ts';
import { retryLeadCreationForVoiceCall } from '../_shared/voice-call-lead-recovery.ts';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const GATHER_GREETING =
  'Thanks for calling CoreFlow. I can quickly collect your details so our team can follow up.';
const GATHER_LANGUAGE = 'en';
const GATHER_VOICE = 'Telnyx.KokoroTTS.af';
const GATHER_USER_RESPONSE_TIMEOUT_MS = 15000;
const GATHER_TRANSCRIPTION_MODEL = 'deepgram/nova-3';

const GATHER_PARAMETERS_SCHEMA = {
  type: 'object',
  properties: {
    full_name: { type: 'string', description: 'Customer full name.' },
    email: { type: 'string', description: 'Customer email address.' },
    company_name: { type: 'string', description: 'Company or business name.' },
    service_needed: { type: 'string', description: 'Requested service or primary need.' },
    notes: { type: 'string', description: 'Any additional context from the caller.' },
  },
  additionalProperties: true,
} as const;

const NON_RETRYABLE_GATHER_STATUSES = new Set([
  'failed',
  'failure',
  'error',
  'cancelled',
  'canceled',
  'timeout',
  'timed_out',
  'no_input',
]);

function ensureNonEmpty(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function commandId(action: 'answer' | 'gather' | 'hangup', callControlId: string) {
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

function buildGatherSpeechConfig() {
  return {
    language: GATHER_LANGUAGE,
    voice: GATHER_VOICE,
    userResponseTimeoutMs: GATHER_USER_RESPONSE_TIMEOUT_MS,
    sendMessageHistoryUpdates: true,
    sendPartialResults: true,
    transcription: {
      model: GATHER_TRANSCRIPTION_MODEL,
    } as Record<string, unknown>,
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

function isUsableGatherResult(value: Record<string, unknown> | null) {
  return value !== null && Object.keys(value).length > 0;
}

function isLeadEligibleGatherStatus(status: string | null) {
  if (!status) {
    return true;
  }

  return !NON_RETRYABLE_GATHER_STATUSES.has(status.trim().toLowerCase());
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

function deriveGatherStatus(providerStatus: string | null, gatherResult: Record<string, unknown> | null) {
  const normalizedStatus = ensureNonEmpty(providerStatus)?.toLowerCase() ?? null;

  if (normalizedStatus && NON_RETRYABLE_GATHER_STATUSES.has(normalizedStatus)) {
    return normalizedStatus === 'failed' || normalizedStatus === 'failure' || normalizedStatus === 'error'
      ? 'failed'
      : 'incomplete';
  }

  if (gatherResult && Object.keys(gatherResult).length > 0) {
    return 'completed';
  }

  return 'incomplete';
}

function isMappingFailure(error: unknown) {
  const message = safeErrorMessage(error).toLowerCase();

  return (
    (error instanceof Error && error.name.toLowerCase().includes('validation')) ||
    message.includes('mapping') ||
    message.includes('snapshot') ||
    message.includes('required') ||
    message.includes('custom field') ||
    message.includes('source')
  );
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

    workspaceId = workspacePhoneNumber.workspace_id;
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
        : normalizedEvent.eventType === 'call.ai_gather.ended' ||
            normalizedEvent.eventType === 'call.conversation.ended'
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
      const activeBinding = runtimeConfig
        ? runtimeConfig.binding
        : await findActiveVoiceAgentBindingForNumber(db, workspaceId, workspacePhoneNumber.id);

      if (runtimeConfig) {
        await setVoiceCallRuntimeMode(db, {
          workspaceId,
          voiceCallId: call.id,
          runtimeMode: 'assistant',
        });
        const snapshot = buildVoiceAgentCallSnapshot(runtimeConfig);
        await updateVoiceCallAssistantContext(db, {
          workspaceId,
          voiceCallId: call.id,
          voiceAgentId: runtimeConfig.agent.id,
          voiceAgentBindingId: runtimeConfig.binding.id,
          assistantMappingSnapshot: snapshot,
        });

        try {
          const recordingResult = await startRecording({
            callControlId: call.provider_call_control_id,
            commandId: recordingCommandId(call.provider_call_control_id),
            clientState: buildClientState(workspaceId, call.id),
            format: 'wav',
            channels: 'single',
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

        try {
          const suppressionResult = await startNoiseSuppression({
            callControlId: call.provider_call_control_id,
            commandId: suppressionCommandId(call.provider_call_control_id),
            clientState: buildClientState(workspaceId, call.id),
            direction: 'inbound',
          });
          console.log('[telnyx-voice-webhook] noise suppression started', {
            workspaceId,
            voiceCallId: call.id,
            callControlId: call.provider_call_control_id,
            commandId: suppressionResult.commandId,
            status: suppressionResult.status,
          });
        } catch (error) {
          console.warn('[telnyx-voice-webhook] noise suppression start failed', {
            workspaceId,
            voiceCallId: call.id,
            callControlId: call.provider_call_control_id,
            message: safeErrorMessage(error),
          });
        }

        const gatherResult = await startGatherUsingAi({
          callControlId: call.provider_call_control_id,
          commandId: commandId('gather', call.provider_call_control_id),
          greeting: runtimeConfig.agent.greeting,
          parametersSchema: buildVoiceAgentGatherSchema(runtimeConfig.mappings) as Record<string, unknown>,
          assistant: buildVoiceAgentAssistantPayload(runtimeConfig.agent),
          clientState: buildClientState(workspaceId, call.id),
          ...buildGatherSpeechConfig(),
        });
        console.log('[telnyx-voice-webhook] gather started', {
          workspaceId,
          voiceCallId: call.id,
          callControlId: call.provider_call_control_id,
          runtimeMode: 'assistant',
          commandId: gatherResult.commandId,
          status: gatherResult.status,
        });
      } else {
        await setVoiceCallRuntimeMode(db, {
          workspaceId,
          voiceCallId: call.id,
          runtimeMode: activeBinding ? 'phase1_fallback' : 'phase1_default',
        });
        await updateVoiceCallAssistantContext(db, {
          workspaceId,
          voiceCallId: call.id,
          voiceAgentId: null,
          voiceAgentBindingId: null,
          assistantMappingSnapshot: null,
        });

        try {
          const recordingResult = await startRecording({
            callControlId: call.provider_call_control_id,
            commandId: recordingCommandId(call.provider_call_control_id),
            clientState: buildClientState(workspaceId, call.id),
            format: 'wav',
            channels: 'single',
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

        try {
          const suppressionResult = await startNoiseSuppression({
            callControlId: call.provider_call_control_id,
            commandId: suppressionCommandId(call.provider_call_control_id),
            clientState: buildClientState(workspaceId, call.id),
            direction: 'inbound',
          });
          console.log('[telnyx-voice-webhook] noise suppression started', {
            workspaceId,
            voiceCallId: call.id,
            callControlId: call.provider_call_control_id,
            commandId: suppressionResult.commandId,
            status: suppressionResult.status,
          });
        } catch (error) {
          console.warn('[telnyx-voice-webhook] noise suppression start failed', {
            workspaceId,
            voiceCallId: call.id,
            callControlId: call.provider_call_control_id,
            message: safeErrorMessage(error),
          });
        }

        const gatherResult = await startGatherUsingAi({
          callControlId: call.provider_call_control_id,
          commandId: commandId('gather', call.provider_call_control_id),
          greeting: GATHER_GREETING,
          parametersSchema: GATHER_PARAMETERS_SCHEMA as Record<string, unknown>,
          clientState: buildClientState(workspaceId, call.id),
          ...buildGatherSpeechConfig(),
        });
        console.log('[telnyx-voice-webhook] gather started', {
          workspaceId,
          voiceCallId: call.id,
          callControlId: call.provider_call_control_id,
          runtimeMode: activeBinding ? 'phase1_fallback' : 'phase1_default',
          commandId: gatherResult.commandId,
          status: gatherResult.status,
        });
      }

      await applyCallGathering(db, {
        workspaceId,
        voiceCallId: call.id,
      });

      await markEventProcessed(db, { workspaceId, eventId });
      return jsonResponse({ ok: true, handled: normalizedEvent.eventType }, 200);
    }

    if (
      normalizedEvent.eventType === 'call.ai_gather.ended' ||
      normalizedEvent.eventType === 'call.conversation.ended'
    ) {
      const messageSummary = summarizeMessageHistory(normalizedEvent.messageHistory);
      console.log('[telnyx-voice-webhook] gather finished event received', {
        workspaceId,
        eventType: normalizedEvent.eventType,
        callControlId: normalizedEvent.callControlId,
        providerGatherStatus: normalizedEvent.gatherStatus,
        gatherResultKeys: normalizedEvent.gatherResult ? Object.keys(normalizedEvent.gatherResult) : [],
        messageSummary,
      });

      const gathered = await applyGatherEnded(db, {
        workspaceId,
        voiceCallId: call.id,
        gatherResult: toJsonValue(normalizedEvent.gatherResult),
        messageHistory: toJsonValue(normalizedEvent.messageHistory),
        providerGatherStatus: normalizedEvent.gatherStatus,
        gatherStatus: deriveGatherStatus(normalizedEvent.gatherStatus, normalizedEvent.gatherResult),
        gatherCompletedAt: occurredAt,
      });

      const canAttemptLead =
        isUsableGatherResult(normalizedEvent.gatherResult) &&
        isLeadEligibleGatherStatus(normalizedEvent.gatherStatus) &&
        gathered.lead_creation_status !== 'created';

      if (canAttemptLead) {
        try {
          const actorUserId = await resolveWorkspaceVoiceActorUserId(db, workspaceId);
          const recovered = await retryLeadCreationForVoiceCall({
            db,
            workspaceId,
            actorUserId,
            voiceCallId: call.id,
          });

          await applyLeadCreated(db, {
            workspaceId,
            voiceCallId: call.id,
            recordId: recovered.created.recordId,
          });

          await finalizeAndTriggerActions({
            db,
            workspaceId,
            voiceCallId: call.id,
            outcomeStatus: 'lead_created',
            outcomeReason: 'lead_created',
          });
        } catch (error) {
          const errorMessage = safeErrorMessage(error);
          await applyLeadFailed(db, { workspaceId, voiceCallId: call.id, errorMessage });
          await finalizeAndTriggerActions({
            db,
            workspaceId,
            voiceCallId: call.id,
            outcomeStatus: isMappingFailure(error) ? 'mapping_failed' : 'crm_failed',
            outcomeReason: isMappingFailure(error) ? 'mapping_failed' : 'crm_write_failed',
            outcomeError: errorMessage,
          });
          await markEventFailed(db, { workspaceId, eventId, errorMessage });

          if (!isRetryableInternalError(error)) {
            return jsonResponse({ ok: true, failed: true, reason: errorMessage }, 200);
          }

          return jsonResponse({ error: errorMessage }, 500);
        }
      } else {
        await finalizeAndTriggerActions({
          db,
          workspaceId,
          voiceCallId: call.id,
          outcomeStatus:
            gathered.lead_creation_status === 'created' || gathered.record_id
              ? 'lead_created'
              : gathered.gather_status === 'incomplete' || gathered.gather_status === 'failed'
              ? 'gather_incomplete'
              : gathered.runtime_mode === 'phase1_fallback'
                ? 'review_needed'
                : 'review_needed',
          outcomeReason:
            gathered.lead_creation_status === 'created' || gathered.record_id
              ? 'lead_created'
              : gathered.gather_status === 'incomplete' || gathered.gather_status === 'failed'
              ? (gathered.provider_gather_status ?? 'gather_incomplete')
              : 'review_needed',
        });
      }

      // Phase 1 ends the call after AI collection because there is no transfer-to-agent or queue handoff yet.
      if (normalizedEvent.eventType !== 'call.conversation.ended') {
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
