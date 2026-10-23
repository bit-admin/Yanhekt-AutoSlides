// Error mapping for the cbiz `{ code, message, data }` envelope
// (docs/architecture.md §9.1). One place for the codes the app words itself;
// any other failure keeps Yanhekt's own message and code.

export interface CbizEnvelope {
  code: number | string;
  message?: string;
}

/** Yanhekt sends `code` as a number or a numeric string. */
export function isCbizOk(payload: CbizEnvelope): boolean {
  return payload.code === 0 || payload.code === '0';
}

/** The error to throw for a failed envelope. */
export function cbizEnvelopeError(payload: CbizEnvelope): Error {
  switch (Number(payload.code)) {
    case 13001001:
      return new Error('Authentication failed, please check if token is valid');
    case 99151011:
      // Gateway could not reach the backend ("failed to invoke service").
      return new Error('Remote server error or is temporarily down, please try again later');
    default:
      return new Error(`API error: ${payload.message} (code: ${payload.code})`);
  }
}
