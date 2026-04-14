export type TelnyxPhase1EventType =
  | 'call.initiated'
  | 'call.answered'
  | 'call.conversation.ended'
  | 'call.hangup';

export interface NormalizedTelnyxEvent {
  provider: 'telnyx';
  providerEventId: string | null;
  eventType: string;
  occurredAt: string | null;
  callControlId: string | null;
  callLegId: string | null;
  callSessionId: string | null;
  connectionId: string | null;
  fromNumberE164: string | null;
  toNumberE164: string | null;
  gatherResult: Record<string, unknown> | null;
  gatherStatus: string | null;
  messageHistory: unknown[] | null;
  rawPayload: Record<string, unknown>;
}

export interface GatherExtraction {
  result: Record<string, unknown> | null;
  messageHistory: unknown[] | null;
  status: string | null;
}

export class TelnyxNormalizeError extends Error {}

export class MalformedTelnyxWebhookError extends TelnyxNormalizeError {}

export class MissingGatherPayloadError extends TelnyxNormalizeError {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getNestedRecord(parent: Record<string, unknown>, key: string) {
  const value = parent[key];
  return isRecord(value) ? value : null;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getString(record[key]);

    if (value) {
      return value;
    }
  }

  return '';
}

function pickArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
}

export function isPhase1HandledEvent(eventType: string): eventType is TelnyxPhase1EventType {
  return (
    eventType === 'call.initiated' ||
    eventType === 'call.answered' ||
    eventType === 'call.conversation.ended' ||
    eventType === 'call.hangup'
  );
}

export function parseTelnyxWebhook(rawJson: unknown): NormalizedTelnyxEvent {
  if (!isRecord(rawJson)) {
    throw new MalformedTelnyxWebhookError('Webhook body must be a JSON object.');
  }

  const data = getNestedRecord(rawJson, 'data') ?? rawJson;
  const payload = getNestedRecord(data, 'payload') ?? getNestedRecord(rawJson, 'payload') ?? {};
  const eventType =
    pickString(data, ['event_type', 'type']) ||
    pickString(rawJson, ['event_type', 'type']) ||
    pickString(payload, ['event_type', 'type']) ||
    'unknown';
  const providerEventId = pickString(data, ['id']) || pickString(rawJson, ['id']) || null;
  const occurredAt =
    pickString(data, ['occurred_at', 'created_at']) ||
    pickString(rawJson, ['occurred_at', 'created_at']) ||
    pickString(payload, ['occurred_at']) ||
    null;
  const callControlId = pickString(payload, ['call_control_id', 'callControlId']) || null;

  if (isPhase1HandledEvent(eventType)) {
    if (!providerEventId) {
      throw new MalformedTelnyxWebhookError(`Missing Telnyx event id for handled event ${eventType}.`);
    }

    if (!occurredAt) {
      throw new MalformedTelnyxWebhookError(`Missing occurred_at for handled event ${eventType}.`);
    }

    if (!callControlId) {
      throw new MalformedTelnyxWebhookError(`Missing call_control_id for handled event ${eventType}.`);
    }
  }

  const gatherResult = isRecord(payload.result) ? payload.result : null;
  const gatherStatus =
    getString(payload.status) ||
    getString(payload.reason) ||
    (gatherResult ? getString(gatherResult.status) : '');
  const messageHistory = pickArray(payload, ['message_history', 'messages']);

  return {
    provider: 'telnyx',
    providerEventId,
    eventType,
    occurredAt,
    callControlId,
    callLegId: pickString(payload, ['call_leg_id']) || null,
    callSessionId: pickString(payload, ['call_session_id']) || null,
    connectionId: pickString(payload, ['connection_id']) || null,
    fromNumberE164: pickString(payload, ['from', 'from_number', 'from_number_e164']) || null,
    toNumberE164: pickString(payload, ['to', 'to_number', 'to_number_e164']) || null,
    gatherResult,
    gatherStatus: gatherStatus || null,
    messageHistory,
    rawPayload: rawJson,
  };
}

export function extractGatherResult(event: NormalizedTelnyxEvent): GatherExtraction {
  if (event.eventType !== 'call.conversation.ended') {
    throw new MissingGatherPayloadError(
      'Gather extraction is only valid for call.conversation.ended.',
    );
  }

  return {
    result: event.gatherResult,
    messageHistory: event.messageHistory,
    status: event.gatherStatus,
  };
}
