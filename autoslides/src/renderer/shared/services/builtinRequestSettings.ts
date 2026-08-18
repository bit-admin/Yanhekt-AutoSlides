// Last advertisement from GET /model for the built-in service. Starts as the
// hardcoded fallback so post-processing / limiter / completion-body consumers
// don't wait on a fetch. `refreshBuiltinModel` (and a successful classify-time
// fetch on main) replace this with the server values.

import {
  BUILTIN_AI_COMPLETION_PARAMS,
  BUILTIN_AI_REQUEST_SETTINGS,
  resolveEffectiveAICompletionParams,
  resolveEffectiveAIRequestSettings,
  toAIRequestSettings,
  toBuiltinCompletionParams,
  type AIRequestSettings,
  type BuiltinCompletionParams,
  type BuiltinModelInfo
} from '@common/aiRequestSettings';

let remoteRequest: AIRequestSettings | null = null;
let remoteCompletion: BuiltinCompletionParams | null = null;

export function setRemoteBuiltinModelInfo(info: BuiltinModelInfo | null): void {
  if (!info) {
    remoteRequest = null;
    remoteCompletion = null;
    return;
  }
  remoteRequest = toAIRequestSettings(info);
  remoteCompletion = toBuiltinCompletionParams(info.requestBody);
}

export function getRemoteBuiltinRequestSettings(): AIRequestSettings | null {
  return remoteRequest ? toAIRequestSettings(remoteRequest) : null;
}

export function resolveRendererAIRequestSettings(
  serviceType: string | undefined,
  stored?: Partial<AIRequestSettings> | null
): AIRequestSettings {
  return resolveEffectiveAIRequestSettings(serviceType, stored, remoteRequest);
}

export function resolveRendererAICompletionParams(
  serviceType: string | undefined,
  stored?: BuiltinCompletionParams | null
): BuiltinCompletionParams {
  return resolveEffectiveAICompletionParams(serviceType, stored, remoteCompletion);
}

export { BUILTIN_AI_COMPLETION_PARAMS, BUILTIN_AI_REQUEST_SETTINGS };
