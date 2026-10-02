import { describe, expect, it } from 'vitest';
import { parseInfoSimple } from './yanhe2Api';

describe('parseInfoSimple', () => {
  it('keeps only the fields media signing needs', () => {
    const body = {
      code: 200,
      message: '查询成功',
      params: { id: 10001, account: '1120230001', realname: 'name', phone: '13800138000', tenant_id: 21 },
    };
    expect(parseInfoSimple(body)).toEqual({ userId: 10001, tenantId: 21, playSigningPhone: '13800138000' });
  });

  it('tolerates a missing phone', () => {
    expect(parseInfoSimple({ code: 200, params: { id: 1, tenant_id: 21, phone: null } }))
      .toEqual({ userId: 1, tenantId: 21, playSigningPhone: '' });
  });

  it('rejects other envelopes', () => {
    expect(parseInfoSimple({ code: 403, params: { id: 1, tenant_id: 21 } })).toBeNull();
    expect(parseInfoSimple({ code: 200, params: { tenant_id: 21 } })).toBeNull();
    expect(parseInfoSimple(null)).toBeNull();
  });
});
