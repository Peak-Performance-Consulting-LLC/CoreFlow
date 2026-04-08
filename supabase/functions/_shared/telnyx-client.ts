export interface TelnyxClientConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface TelnyxCommandResult<TData = Record<string, unknown>> {
  accepted: true;
  status: number;
  commandId: string | null;
  data: TData | null;
  raw: Record<string, unknown> | null;
}

export interface AnswerCallParams extends TelnyxClientConfig {
  callControlId: string;
  commandId?: string;
  clientState?: string;
}

export interface StartGatherUsingAiParams extends TelnyxClientConfig {
  callControlId: string;
  commandId?: string;
  greeting?: string;
  parametersSchema: Record<string, unknown>;
  assistant?: Record<string, unknown>;
  messageHistory?: unknown[];
  sendMessageHistoryUpdates?: boolean;
  sendPartialResults?: boolean;
  transcription?: Record<string, unknown>;
  userResponseTimeoutMs?: number;
  gatherEndedSpeech?: string;
  voice?: string;
  voiceSettings?: Record<string, unknown>;
  language?: string;
  clientState?: string;
  interruptionSettings?: Record<string, unknown>;
}

export interface HangupCallParams extends TelnyxClientConfig {
  callControlId: string;
  commandId?: string;
}

export class TelnyxClientError extends Error {}

export class TelnyxClientConfigError extends TelnyxClientError {}

export class TelnyxNetworkError extends TelnyxClientError {}

export class TelnyxTimeoutError extends TelnyxClientError {}

export class TelnyxApiError extends TelnyxClientError {
  status: number;
  responseBody: unknown;

  constructor(message: string, status: number, responseBody: unknown) {
    super(message);
    this.status = status;
    this.responseBody = responseBody;
  }
}

const DEFAULT_BASE_URL = 'https://api.telnyx.com/v2';
const DEFAULT_TIMEOUT_MS = 10000;

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveClientConfig(config: TelnyxClientConfig) {
  const apiKey = getString(config.apiKey) || getString(Deno.env.get('TELNYX_API_KEY'));
  const baseUrl = getString(config.baseUrl) || getString(Deno.env.get('TELNYX_API_BASE_URL')) || DEFAULT_BASE_URL;
  const timeoutFromEnv = Number.parseInt(getString(Deno.env.get('TELNYX_API_TIMEOUT_MS')), 10);
  const timeoutMs = Number.isFinite(config.timeoutMs)
    ? Number(config.timeoutMs)
    : Number.isFinite(timeoutFromEnv)
      ? timeoutFromEnv
      : DEFAULT_TIMEOUT_MS;

  if (!apiKey) {
    throw new TelnyxClientConfigError('Missing TELNYX_API_KEY.');
  }

  if (!baseUrl) {
    throw new TelnyxClientConfigError('Missing Telnyx API base URL.');
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    timeoutMs: Math.max(1000, timeoutMs),
  };
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function postTelnyxCommand<TData = Record<string, unknown>>(
  config: TelnyxClientConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<TelnyxCommandResult<TData>> {
  const { apiKey, baseUrl, timeoutMs } = resolveClientConfig(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${baseUrl}${path}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const parsedBody = await parseJsonSafe(response);

    if (!response.ok) {
      throw new TelnyxApiError(
        `Telnyx command failed with status ${response.status}.`,
        response.status,
        parsedBody,
      );
    }

    const data = isRecord(parsedBody) && isRecord(parsedBody.data)
      ? (parsedBody.data as TData)
      : null;
    const commandIdFromResponse = isRecord(data) ? getString(data.command_id) : '';
    const commandIdFromBody = getString(body.command_id);

    return {
      accepted: true,
      status: response.status,
      commandId: commandIdFromResponse || commandIdFromBody || null,
      data,
      raw: isRecord(parsedBody) ? parsedBody : null,
    };
  } catch (error) {
    if (error instanceof TelnyxApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new TelnyxTimeoutError('Telnyx request timed out.');
    }

    const message = error instanceof Error ? error.message : 'Telnyx network error.';
    throw new TelnyxNetworkError(message);
  } finally {
    clearTimeout(timeout);
  }
}

export async function answerCall(params: AnswerCallParams) {
  const commandId = getString(params.commandId);
  const clientState = getString(params.clientState);

  return postTelnyxCommand(params, `/calls/${params.callControlId}/actions/answer`, {
    ...(commandId ? { command_id: commandId } : {}),
    ...(clientState ? { client_state: clientState } : {}),
  });
}

export async function startGatherUsingAi(params: StartGatherUsingAiParams) {
  const commandId = getString(params.commandId);
  const greeting = getString(params.greeting);
  const voice = getString(params.voice);
  const language = getString(params.language);
  const clientState = getString(params.clientState);
  const gatherEndedSpeech = getString(params.gatherEndedSpeech);
  const userResponseTimeoutMs = Number.isFinite(params.userResponseTimeoutMs)
    ? Number(params.userResponseTimeoutMs)
    : null;

  return postTelnyxCommand(params, `/calls/${params.callControlId}/actions/gather_using_ai`, {
    ...(greeting ? { greeting } : {}),
    parameters: params.parametersSchema,
    ...(isRecord(params.assistant) ? { assistant: params.assistant } : {}),
    ...(Array.isArray(params.messageHistory) ? { message_history: params.messageHistory } : {}),
    ...(typeof params.sendMessageHistoryUpdates === 'boolean'
      ? { send_message_history_updates: params.sendMessageHistoryUpdates }
      : {}),
    ...(typeof params.sendPartialResults === 'boolean' ? { send_partial_results: params.sendPartialResults } : {}),
    ...(isRecord(params.transcription) ? { transcription: params.transcription } : {}),
    ...(userResponseTimeoutMs !== null ? { user_response_timeout_ms: userResponseTimeoutMs } : {}),
    ...(gatherEndedSpeech ? { gather_ended_speech: gatherEndedSpeech } : {}),
    ...(commandId ? { command_id: commandId } : {}),
    ...(voice ? { voice } : {}),
    ...(isRecord(params.voiceSettings) ? { voice_settings: params.voiceSettings } : {}),
    ...(language ? { language } : {}),
    ...(clientState ? { client_state: clientState } : {}),
    ...(isRecord(params.interruptionSettings) ? { interruption_settings: params.interruptionSettings } : {}),
  });
}

export async function hangupCall(params: HangupCallParams) {
  const commandId = getString(params.commandId);

  return postTelnyxCommand(params, `/calls/${params.callControlId}/actions/hangup`, {
    ...(commandId ? { command_id: commandId } : {}),
  });
}
