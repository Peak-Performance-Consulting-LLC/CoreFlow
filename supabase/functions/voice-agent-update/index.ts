import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { authenticateRequest, ensureWorkspaceOwner } from '../_shared/server.ts';
import { findVoiceAgentById, updateVoiceAgent } from '../_shared/voice-agent-repository.ts';
import {
  assertVoiceAgentStatusTransition,
  validateVoiceAgentPayload,
} from '../_shared/voice-agent-validator.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authContext = await authenticateRequest(request);

    if (authContext instanceof Response) {
      return authContext;
    }

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const workspaceId = typeof payload.workspace_id === 'string' ? payload.workspace_id.trim() : '';
    const voiceAgentId = typeof payload.voice_agent_id === 'string' ? payload.voice_agent_id.trim() : '';

    if (!workspaceId || !voiceAgentId) {
      return jsonResponse({ error: 'workspace_id and voice_agent_id are required.' }, 400);
    }

    await ensureWorkspaceOwner(authContext.serviceClient, workspaceId, authContext.user.id);
    const current = await findVoiceAgentById(authContext.serviceClient, workspaceId, voiceAgentId);
    const validated = await validateVoiceAgentPayload(authContext.serviceClient, workspaceId, {
      name: typeof payload.name === 'string' ? payload.name : undefined,
      description: typeof payload.description === 'string' ? payload.description : payload.description === null ? null : undefined,
      greeting: typeof payload.greeting === 'string' ? payload.greeting : undefined,
      system_prompt: typeof payload.system_prompt === 'string' ? payload.system_prompt : undefined,
      source_id: typeof payload.source_id === 'string' ? payload.source_id : payload.source_id === null ? null : undefined,
      fallback_mode:
        typeof payload.fallback_mode === 'string' ? payload.fallback_mode : payload.fallback_mode === null ? null : undefined,
      record_creation_mode:
        typeof payload.record_creation_mode === 'string'
          ? payload.record_creation_mode
          : payload.record_creation_mode === null
            ? null
            : undefined,
      status: typeof payload.status === 'string' ? payload.status as 'draft' | 'active' | 'disabled' : current.status,
    });

    const nextStatus = validated.status ?? current.status;

    if (nextStatus === 'active') {
      await assertVoiceAgentStatusTransition(authContext.serviceClient, workspaceId, voiceAgentId, 'active', {
        greeting: validated.greeting ?? current.greeting,
        systemPrompt: validated.systemPrompt ?? current.system_prompt,
        sourceId: validated.sourceId ?? current.source_id,
      });
    }

    const agent = await updateVoiceAgent(authContext.serviceClient, {
      workspaceId,
      voiceAgentId,
      name: validated.name,
      description: validated.description,
      status: nextStatus,
      greeting: validated.greeting,
      systemPrompt: validated.systemPrompt,
      sourceId: validated.sourceId,
      fallbackMode: validated.fallbackMode,
      recordCreationMode: validated.recordCreationMode,
      updatedBy: authContext.user.id,
    });

    return jsonResponse({ agent });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    const activationIssues =
      error instanceof Error && 'issues' in error && Array.isArray((error as { issues?: string[] }).issues)
        ? (error as { issues?: string[] }).issues
        : undefined;
    return jsonResponse({ error: message, ...(activationIssues ? { activation_issues: activationIssues } : {}) }, 400);
  }
});
