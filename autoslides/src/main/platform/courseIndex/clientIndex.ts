/**
 * The part of the index release that the desktop app reads, and the code both
 * sides share to write and check it.
 *
 *   client-manifest.json                          signed envelope (below), replaced last
 *   term-<term>.<sha256:12>.<rid>.json.gz.age     one per term: gzip, then age to every recipient
 *
 * Format 2 (2026-11-03): every reader holds its own age key pair (age.ts) and
 * is a recipient of every file; `rid` names the recipient set, so adding or
 * removing a reader gives new file names. The desktop app is one recipient,
 * its identity built in (obfuscated only, so anyone may dig it out). Others
 * read with the stock tool: `age -d -i key.txt term-….json.gz.age | gunzip`.
 * The publisher holds only public recipients. Format 1 (one shared client
 * passphrase, OpenSSL format) is no longer published.
 *
 * The envelope is plain JSON holding the encrypted client manifest (base64),
 * the recipients, and an ed25519 signature over its name, size and SHA-256,
 * so one file carries both and a reader never sees a manifest without its
 * signature. The manifest lists each term file with the SHA-256 of its
 * encrypted bytes (checked before decrypting) and of its JSON (checked after).
 * The signature is what proves a file came from the indexer. The full
 * database stays under the private passphrase (release.ts).
 *
 * Copied byte for byte to autoslides/src/main/platform/courseIndex/clientIndex.ts
 * (scripts/check-drift.mjs): edit this file, then copy it over. Node built-ins
 * only, no relative imports, ES2020.
 */

import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

export const CLIENT_MANIFEST_ASSET = 'client-manifest.json';
export const ENVELOPE_FORMAT = 'autoslides-index-envelope/v2';
export const CLIENT_MANIFEST_FORMAT = 2;

/** Term JSON layout (export.ts). */
export const TERM_FORMAT = 1;
export const TERM_FIELDS = ['id', 'name', 'number', 'teachers', 'sessions'] as const;

export interface ClientTerm {
  term: string;
  asset: string;
  /** Size and SHA-256 (hex) of the encrypted asset. */
  bytes: number;
  assetSha256: string;
  /** SHA-256 (hex) of the term JSON. */
  sha256: string;
  courses: number;
  sessions: number;
}

export interface ClientManifest {
  format: number;
  generatedAt: string;
  /** recipientsId() of the recipients every file is encrypted to. */
  recipientsId: string;
  terms: ClientTerm[];
}

export interface SigningKey {
  id: string;
  /** SPKI PEM. */
  publicKey: string;
}

export function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** First 16 hex digits of the SHA-256 of the public key's SPKI DER. */
export function keyIdOf(publicKey: KeyObject): string {
  return sha256Hex(publicKey.export({ format: 'der', type: 'spki' }) as Buffer).slice(0, 16);
}

/** A short public name for a recipient set (8 hex digits), the same whatever their order. */
export function recipientsId(recipients: string[]): string {
  return sha256Hex(Buffer.from(`autoslides-index-recipients\n${[...new Set(recipients)].sort().join('\n')}`, 'utf8')).slice(0, 8);
}

/** `<term>` sorts correctly as a string. Term asset names carry the recipients id, so new recipients mean new files. */
export function termAssetName(term: string, sha256: string, rid: string): string {
  return `term-${term}.${sha256.slice(0, 12)}.${rid}.json.gz.age`;
}

/** Term files of any format this or an earlier release wrote. */
export const TERM_ASSET_PATTERN = /^term-.*\.json\.gz\.(?:age|enc)$/;

function signedMessage(file: string, size: number, sha256: string): Buffer {
  return Buffer.from(`${ENVELOPE_FORMAT}\n${file}\n${size}\n${sha256}\n`, 'utf8');
}

/** The envelope's JSON text for `data` (encrypted to `recipients`) published as `file`. */
export function makeEnvelope(file: string, data: Buffer, recipients: string[], privateKey: KeyObject): string {
  const sha256 = sha256Hex(data);
  return JSON.stringify({
    format: ENVELOPE_FORMAT,
    file,
    key: keyIdOf(createPublicKey(privateKey)),
    recipients: [...new Set(recipients)].sort(),
    size: data.length,
    sha256,
    signature: sign(null, signedMessage(file, data.length, sha256), privateKey).toString('base64'),
    data: data.toString('base64'),
  }, null, 1) + '\n';
}

export type EnvelopeFailure =
  | 'malformed'    // not an envelope
  | 'wrong-file'   // an envelope for another file
  | 'unknown-key'  // signed with a key the reader does not have
  | 'mismatch';    // the data is not what was signed

export type EnvelopeResult =
  | { ok: true; data: Buffer; keyId: string; recipients: string[] }
  | { ok: false; reason: EnvelopeFailure };

/**
 * Checks an envelope against `keys` and returns its data. The name is the one
 * the reader expects and the size and hash are measured, never the envelope's own.
 */
export function openEnvelope(text: string, expectedFile: string, keys: SigningKey[]): EnvelopeResult {
  let e: Record<string, unknown>;
  try {
    e = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!e || e.format !== ENVELOPE_FORMAT || typeof e.key !== 'string' || typeof e.signature !== 'string'
    || typeof e.data !== 'string' || !Array.isArray(e.recipients) || !e.recipients.every((r) => typeof r === 'string')) {
    return { ok: false, reason: 'malformed' };
  }
  if (e.file !== expectedFile) return { ok: false, reason: 'wrong-file' };
  const keyId = e.key;
  const entry = keys.find((k) => k.id === keyId);
  if (!entry) return { ok: false, reason: 'unknown-key' };
  const data = Buffer.from(e.data, 'base64');
  let valid = false;
  try {
    valid = verify(null, signedMessage(expectedFile, data.length, sha256Hex(data)), createPublicKey(entry.publicKey),
      Buffer.from(e.signature, 'base64'));
  } catch {
    valid = false;
  }
  return valid ? { ok: true, data, keyId, recipients: e.recipients as string[] } : { ok: false, reason: 'mismatch' };
}

/** A parsed client manifest, or an error when it does not have the expected shape. */
export function parseClientManifest(json: Buffer | string): ClientManifest {
  const m = JSON.parse(json.toString()) as ClientManifest;
  if (!m || m.format !== CLIENT_MANIFEST_FORMAT || !Array.isArray(m.terms) || typeof m.recipientsId !== 'string') {
    throw new Error('unsupported client manifest');
  }
  for (const t of m.terms) {
    if (typeof t.term !== 'string' || typeof t.asset !== 'string' || typeof t.assetSha256 !== 'string' || typeof t.sha256 !== 'string') {
      throw new Error('unsupported client manifest');
    }
    // Asset names become file names on the reader's side.
    if (!/^[\w.-]+$/.test(t.asset)) throw new Error(`bad asset name in client manifest: ${t.asset}`);
  }
  return m;
}

export interface TermCourse {
  /** Yanhekt ids as strings. */
  id: string;
  name: string;
  /** Registrar course code, when Yanhekt has one. */
  number: string | null;
  teachers: string[];
  sessionIds: string[];
}

/** One term JSON (export.ts) → its courses. Throws when it is another layout or another term. */
export function parseTermDoc(json: Buffer | string, expectedTerm: string): TermCourse[] {
  const doc = JSON.parse(json.toString()) as { format?: unknown; term?: unknown; fields?: unknown; courses?: unknown };
  if (doc.format !== TERM_FORMAT || JSON.stringify(doc.fields) !== JSON.stringify(TERM_FIELDS) || !Array.isArray(doc.courses)) {
    throw new Error('unsupported term file');
  }
  if (doc.term !== expectedTerm) throw new Error(`term file is for ${String(doc.term)}, expected ${expectedTerm}`);
  return (doc.courses as unknown[][]).map((c) => ({
    id: String(c[0]),
    name: String(c[1] ?? ''),
    number: c[2] == null || c[2] === '' ? null : String(c[2]),
    teachers: Array.isArray(c[3]) ? (c[3] as unknown[]).map(String) : [],
    sessionIds: Array.isArray(c[4]) ? (c[4] as unknown[]).map(String) : [],
  }));
}
