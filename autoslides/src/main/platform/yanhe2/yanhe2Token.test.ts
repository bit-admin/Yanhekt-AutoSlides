import { describe, expect, it } from 'vitest';
import { decodeYanhe2Claims, extractYanhe2Jwt, extractYanhe2JwtFromSetCookie } from './yanhe2Token';

function jwtWith(payload: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}.c2lnbmF0dXJlLWJ5dGVz`;
}

const JWT = jwtWith({ account: '1120230001', sub: 10001, tenant_id: 21, exp: 1790663933 });

/** `_token` as casapi sets it: HMAC hex + URL-encoded PHP-serialized pair (synthetic). */
function signedTokenCookie(jwt: string): string {
  const php = `a:2:{i:0;s:6:"_token";i:1;s:${jwt.length}:"${jwt}";}`;
  return `${'ab'.repeat(32)}${encodeURIComponent(php)}`;
}

describe('extractYanhe2Jwt', () => {
  it('accepts a bare JWT and a Bearer value', () => {
    expect(extractYanhe2Jwt(JWT)).toBe(JWT);
    expect(extractYanhe2Jwt(`Bearer ${JWT}`)).toBe(JWT);
  });

  it('reads the JWT out of the signed _token cookie inside a Cookie header', () => {
    const header = `PHPSESSID=abc; _token=${signedTokenCookie(JWT)}; JWTUser=%7B%22id%22%3A1%7D`;
    expect(extractYanhe2Jwt(header)).toBe(JWT);
  });

  it('prefers _token over another JWT-shaped cookie', () => {
    const other = jwtWith({ account: 'someone-else', exp: 1 });
    expect(extractYanhe2Jwt(`live_token=${other}; _token=${signedTokenCookie(JWT)}`)).toBe(JWT);
  });

  it('returns null when there is no token', () => {
    expect(extractYanhe2Jwt('')).toBeNull();
    expect(extractYanhe2Jwt('PHPSESSID=abc; tenant_code=21')).toBeNull();
  });
});

describe('extractYanhe2JwtFromSetCookie', () => {
  it('only looks at _token lines', () => {
    const lines = [
      'JWTUser=%7B%7D; Max-Age=604800; Domain=.yanhekt.cn',
      `_token=${signedTokenCookie(JWT)}; Max-Age=57600; Path=/; Domain=.yanhekt.cn`,
    ];
    expect(extractYanhe2JwtFromSetCookie(lines)).toBe(JWT);
    expect(extractYanhe2JwtFromSetCookie([`live_token=${JWT}`])).toBeNull();
  });
});

describe('decodeYanhe2Claims', () => {
  it('reads account and exp, coercing a numeric account', () => {
    expect(decodeYanhe2Claims(JWT)).toEqual({ account: '1120230001', exp: 1790663933 });
    expect(decodeYanhe2Claims(jwtWith({ account: 1120230001, exp: 5 }))).toEqual({ account: '1120230001', exp: 5 });
  });

  it('rejects payloads without the claims we key on', () => {
    expect(decodeYanhe2Claims(jwtWith({ exp: 5 }))).toBeNull();
    expect(decodeYanhe2Claims(jwtWith({ account: 'x' }))).toBeNull();
    expect(decodeYanhe2Claims('not.a.jwt')).toBeNull();
  });
});
