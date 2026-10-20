/** SQL literal for statements sent without bound parameters (D1 uploads, dumps). */
export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'bigint') return String(v);
  if (v instanceof Uint8Array) {
    let hex = '';
    for (const b of v) hex += b.toString(16).padStart(2, '0');
    return `X'${hex}'`;
  }
  return `'${String(v).replaceAll("'", "''")}'`;
}
