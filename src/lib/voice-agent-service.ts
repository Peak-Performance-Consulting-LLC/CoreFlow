import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export type VoiceAgentStatus = 'draft' | 'active' | 'disabled';
export type VoiceAgentMappingTargetType = 'core' | 'custom';
export type VoiceAgentSourceValueType = 'string' | 'number' | 'boolean' | 'array';

export interface VoiceAgentRecord {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: VoiceAgentStatus;
  greeting: string;
  system_prompt: string;
  source_id: string | null;
  fallback_mode: string | null;
  record_creation_mode: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceAgentBindingRecord {
  id: string;
  workspace_id: string;
  voice_agent_id: string;
  workspace_phone_number_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  phone_number_e164: string | null;
  phone_number_label: string | null;
  phone_number_is_active: boolean | null;
  phone_number_provisioning_status: string | null;
  phone_number_webhook_status: string | null;
}

export interface VoiceAgentMappingRecord {
  id: string;
  workspace_id: string;
  voice_agent_id: string;
  source_key: string;
  source_label: string;
  source_description: string | null;
  source_value_type: VoiceAgentSourceValueType;
  target_type: VoiceAgentMappingTargetType;
  target_key: string;
  is_required: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface VoiceAgentSummary extends VoiceAgentRecord {
  active_bindings: VoiceAgentBindingRecord[];
}

export interface VoiceAgentDetailResponse {
  agent: VoiceAgentRecord;
  bindings: VoiceAgentBindingRecord[];
  mappings: VoiceAgentMappingRecord[];
}

export interface VoiceAgentCreateInput {
  workspace_id: string;
  name: string;
  description?: string | null;
  greeting: string;
  system_prompt: string;
  source_id?: string | null;
  fallback_mode?: string | null;
  record_creation_mode?: string | null;
  status?: VoiceAgentStatus;
}

export interface VoiceAgentUpdateInput {
  workspace_id: string;
  voice_agent_id: string;
  name?: string;
  description?: string | null;
  greeting?: string;
  system_prompt?: string;
  source_id?: string | null;
  fallback_mode?: string | null;
  record_creation_mode?: string | null;
  status?: VoiceAgentStatus;
}

export interface VoiceAgentBindingInput {
  workspace_id: string;
  voice_agent_id: string;
  workspace_phone_number_id: string;
  is_active: boolean;
}

export interface VoiceAgentMappingInput {
  source_key: string;
  source_label: string;
  source_description?: string | null;
  source_value_type: VoiceAgentSourceValueType;
  target_type: VoiceAgentMappingTargetType;
  target_key: string;
  is_required: boolean;
  position: number;
}

export class VoiceAgentServiceError extends Error {
  activationIssues: string[];

  constructor(message: string, activationIssues: string[] = []) {
    super(message);
    this.name = 'VoiceAgentServiceError';
    this.activationIssues = activationIssues;
  }
}

function getAuthHeaders(session: Session) {
  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function parseInvokeError(error: unknown) {
  let message = error instanceof Error ? error.message : 'Request failed.';
  let activationIssues: string[] = [];
  const context = isRecord(error) ? error.context : null;

  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();

      if (isRecord(payload)) {
        if (typeof payload.error === 'string' && payload.error.trim()) {
          message = payload.error.trim();
        }

        if (Array.isArray(payload.activation_issues)) {
          activationIssues = payload.activation_issues
            .filter((issue): issue is string => typeof issue === 'string')
            .map((issue) => issue.trim())
            .filter(Boolean);
        }
      }
    } catch {
      // Ignore malformed error payloads and fall back to the generic message.
    }
  }

  return { message, activationIssues };
}

async function invoke<TResponse>(name: string, session: Session, body?: unknown) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke<TResponse>(name, {
    body: body as Record<string, unknown> | undefined,
    headers: getAuthHeaders(session),
  });

  if (error) {
    const parsedError = await parseInvokeError(error);
    throw new VoiceAgentServiceError(parsedError.message, parsedError.activationIssues);
  }

  return data as TResponse;
}

export async function listVoiceAgents(session: Session, workspaceId: string) {
  return invoke<{ agents: VoiceAgentSummary[] }>('voice-agent-list', session, {
    workspace_id: workspaceId,
  });
}

export async function getVoiceAgent(session: Session, workspaceId: string, voiceAgentId: string) {
  return invoke<VoiceAgentDetailResponse>('voice-agent-get', session, {
    workspace_id: workspaceId,
    voice_agent_id: voiceAgentId,
  });
}

export async function createVoiceAgent(session: Session, payload: VoiceAgentCreateInput) {
  return invoke<{ agent: VoiceAgentRecord; activation_issues?: string[] }>('voice-agent-create', session, payload);
}

export async function updateVoiceAgent(session: Session, payload: VoiceAgentUpdateInput) {
  return invoke<{ agent: VoiceAgentRecord; activation_issues?: string[] }>('voice-agent-update', session, payload);
}

export async function bindVoiceAgentNumber(session: Session, payload: VoiceAgentBindingInput) {
  return invoke<{ binding: VoiceAgentBindingRecord }>('voice-agent-bind-number', session, payload);
}

export async function setVoiceAgentMappings(
  session: Session,
  payload: {
    workspace_id: string;
    voice_agent_id: string;
    mappings: VoiceAgentMappingInput[];
  },
) {
  return invoke<{ mappings: VoiceAgentMappingRecord[] }>('voice-agent-set-mappings', session, payload);
}
