/**
 * The one Yanhe 2.0 API call the sign-in needs: `GET /userapi/v1/infosimple`.
 *
 * It is both the liveness check for a token and the only source of the three
 * values later media signing needs (`id`, `tenant_id`, `phone`). The response
 * also carries the real name and phone number, so the body is never logged —
 * only the fields below leave this module.
 */
import { YANHE2_ORIGIN, YANHE2_TENANT_ID } from '@common/yanhe2';

const INFO_URL = `${YANHE2_ORIGIN}/userapi/v1/infosimple`;
const TIMEOUT_MS = 15_000;

export interface Yanhe2Profile {
  userId: number;
  tenantId: number;
  /** infosimple `phone`. The `/play/` signing secret; possibly a placeholder, not the student's number. */
  playSigningPhone: string;
}

export type Yanhe2ProfileResult =
  | { kind: 'ok'; profile: Yanhe2Profile }
  /** 403, or a 200 whose envelope says no: the token is not accepted. */
  | { kind: 'rejected' }
  | { kind: 'network' };

/** Read the fields we keep out of an infosimple envelope (`{code:200, params}`). */
export function parseInfoSimple(body: unknown): Yanhe2Profile | null {
  if (!body || typeof body !== 'object') return null;
  const { code, params } = body as Record<string, unknown>;
  if (code !== 200 || !params || typeof params !== 'object') return null;
  const { id, tenant_id: tenantId, phone } = params as Record<string, unknown>;
  const userId = Number(id);
  const tenant = Number(tenantId);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(tenant)) return null;
  return { userId, tenantId: tenant, playSigningPhone: typeof phone === 'string' ? phone : '' };
}

export async function fetchYanhe2Profile(jwt: string): Promise<Yanhe2ProfileResult> {
  let response: Response;
  try {
    response = await fetch(INFO_URL, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/json',
        'tenant-id': String(YANHE2_TENANT_ID),
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { kind: 'network' };
  }
  // A bad or expired token is a bare 403 with an empty body.
  if (response.status === 401 || response.status === 403) return { kind: 'rejected' };
  if (!response.ok) return { kind: 'network' };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'network' };
  }
  const profile = parseInfoSimple(body);
  return profile ? { kind: 'ok', profile } : { kind: 'rejected' };
}
