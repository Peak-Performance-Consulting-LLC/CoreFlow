import type { EdgeClient } from './server.ts';
import { createLeadFromVoiceCall, ensureInboundCallSource, type CreateLeadFromVoiceCallResult } from './voice-lead-create.ts';
import { mapGatherResultToLeadInput, type LeadCreateInput } from './voice-lead-mapper.ts';
import {
  findVoiceCallById,
  type VoiceCallRow,
} from './voice-repository.ts';
import {
  mapVoiceAgentGatherResultToLeadInput,
  parseVoiceAgentCallSnapshot,
} from './voice-agent-mapper.ts';
import { revalidateVoiceAgentSnapshotTargets } from './voice-agent-validator.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureNonEmpty(value: unknown, field: string) {
  const normalized = normalizeString(value);

  if (!normalized) {
    throw new Error(`${field} is required.`);
  }

  return normalized;
}

function toGatherObject(value: unknown) {
  return isRecord(value) ? value : null;
}

export async function buildLeadCreateInputFromVoiceCall(params: {
  db: EdgeClient;
  workspaceId: string;
  call: VoiceCallRow;
}): Promise<LeadCreateInput> {
  const workspaceId = ensureNonEmpty(params.workspaceId, 'workspaceId');
  const fromNumberE164 = ensureNonEmpty(params.call.from_number_e164, 'from_number_e164');
  const gatherResult = toGatherObject(params.call.gather_result);

  if (!gatherResult || Object.keys(gatherResult).length === 0) {
    throw new Error('This call does not have a usable gather result.');
  }

  const inboundSource = await ensureInboundCallSource(params.db, workspaceId);
  const snapshot = parseVoiceAgentCallSnapshot(params.call.assistant_mapping_snapshot);

  if (params.call.assistant_mapping_snapshot !== null) {
    if (!snapshot) {
      throw new Error('Voice assistant snapshot is missing or invalid for this call.');
    }

    await revalidateVoiceAgentSnapshotTargets(params.db, workspaceId, snapshot.mappings);

    return mapVoiceAgentGatherResultToLeadInput({
      fromNumberE164,
      gatherResult,
      snapshot,
      fallbackSourceId: inboundSource.sourceId,
    });
  }

  return mapGatherResultToLeadInput({
    workspaceId,
    fromNumberE164,
    gatherResult,
    sourceId: inboundSource.sourceId,
  });
}

export async function retryLeadCreationForVoiceCall(params: {
  db: EdgeClient;
  workspaceId: string;
  voiceCallId: string;
  actorUserId: string;
}): Promise<{
  call: VoiceCallRow;
  mappedInput: LeadCreateInput;
  created: CreateLeadFromVoiceCallResult;
}> {
  const workspaceId = ensureNonEmpty(params.workspaceId, 'workspaceId');
  const voiceCallId = ensureNonEmpty(params.voiceCallId, 'voiceCallId');
  const actorUserId = ensureNonEmpty(params.actorUserId, 'actorUserId');
  const call = await findVoiceCallById(params.db, workspaceId, voiceCallId);
  const mappedInput = await buildLeadCreateInputFromVoiceCall({
    db: params.db,
    workspaceId,
    call,
  });

  const created = await createLeadFromVoiceCall({
    db: params.db,
    workspaceId,
    actorUserId,
    mappedInput,
  });

  return {
    call,
    mappedInput,
    created,
  };
}
