// Turn whatever a service threw into a CliError with the right code.
import { isConnectionFailure } from '@main/infra/intranetTransport';
import { YanhektLookupError } from '@main/platform/apiClient';
import { queueErrorText } from '@common/recordingProblems';
import { CliError } from './errors';

export function toCliError(error: unknown): CliError {
  if (error instanceof CliError) return error;
  if (error instanceof YanhektLookupError) return new CliError(error.kind, error.message);
  if (isConnectionFailure(error)) {
    const code = (error as { code?: string }).code;
    return new CliError('network', `Yanhekt did not answer${code ? ` (${code})` : ''}`);
  }
  const message = error instanceof Error ? error.message : String(error);
  return new CliError('failed', queueErrorText(message) || 'unknown error');
}
