/**
 * Yanhe 2.0 transcript: the speech recognition of one lecture
 * (`search-trans-result`).
 *
 * A lecture without one answers HTTP 200 `{code:10002}`, which is a real
 * answer and comes back as an empty list. `all_content` is the array;
 * `trans_content` is the same array again as a string and is not read.
 * `TransText` (a translation) has been empty on every lecture seen, so it is
 * not part of the model.
 */
import type { Yanhe2TranscriptLine } from '@common/yanhe2Transcript';
import { YANHE2_READ_PATHS, readYanhe2, type Yanhe2Fetched } from './yanhe2Http';

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);

/** `未查询到语音数据`: the lecture has no transcript. */
const NO_TRANSCRIPT = 10002;

export function parseYanhe2Transcript(body: unknown): Yanhe2TranscriptLine[] | null {
  if (!isRow(body)) return null;
  if (body.code === NO_TRANSCRIPT) return [];
  if (body.code !== 0) return null;
  const first = Array.isArray(body.list) ? body.list[0] : null;
  const content = isRow(first) && Array.isArray(first.all_content) ? first.all_content : [];
  const lines: Yanhe2TranscriptLine[] = [];
  for (const item of content) {
    if (!isRow(item)) continue;
    const text = typeof item.Text === 'string' ? item.Text.trim() : '';
    const begin = Number(item.BeginSec);
    if (!text || !Number.isFinite(begin) || begin < 0) continue;
    const end = Number(item.EndSec);
    // Times are whole seconds, so a short line can end where it begins.
    lines.push({ begin, end: Number.isFinite(end) && end > begin ? end : begin + 1, text });
  }
  return lines.sort((a, b) => a.begin - b.begin);
}

export async function fetchYanhe2Transcript(jwt: string, subId: string): Promise<Yanhe2Fetched<Yanhe2TranscriptLine[]>> {
  const fetched = await readYanhe2(jwt, YANHE2_READ_PATHS.transcript, { sub_id: subId, format: 'json' });
  if (fetched.kind !== 'ok') return fetched;
  const data = parseYanhe2Transcript(fetched.data);
  return data
    ? { kind: 'ok', data }
    : { kind: 'failed', detail: `${YANHE2_READ_PATHS.transcript} answered an unexpected shape` };
}
