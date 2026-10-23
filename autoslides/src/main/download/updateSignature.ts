// Checks a downloaded installer against its `<file>.sig` before the app opens it.
//
// Every release asset is signed with the project's ed25519 key
// (scripts/update-signing.mjs; CI for Windows and Linux, `make:mac` on the
// release Mac). The signature covers the file name, size and SHA-256, so a
// mirror cannot swap in a different file, an older release under a newer
// name, or a truncated download. The format must match the script;
// updateSignature.test.ts signs with the script and verifies here.
import * as crypto from 'crypto';
import * as fs from 'fs';
import signingKeys from './updateSigningKeys.json';

export const SIGNATURE_FORMAT = 'autoslides-update-signature/v1';

export interface SigningKey {
  id: string;
  publicKey: string;
}

export type SignatureFailure =
  | 'missing'        // no .sig file
  | 'malformed'      // .sig is not the expected JSON
  | 'unknown-key'    // signed with a key the app does not ship
  | 'mismatch';      // the file is not the one that was signed

export type SignatureResult = { ok: true; keyId: string } | { ok: false; reason: SignatureFailure };

const BUILTIN_KEYS: SigningKey[] = signingKeys.keys;

export function signedMessage(filename: string, size: number, sha256: string): Buffer {
  return Buffer.from(`${SIGNATURE_FORMAT}\n${filename}\n${size}\n${sha256}\n`, 'utf8');
}

export async function hashFile(filePath: string): Promise<{ sha256: string; size: number }> {
  const hash = crypto.createHash('sha256');
  let size = 0;
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk as Buffer);
    size += (chunk as Buffer).length;
  }
  return { sha256: hash.digest('hex'), size };
}

interface SignatureFile {
  key: string;
  signature: string;
}

function parseSignatureFile(text: string): SignatureFile | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed.format !== SIGNATURE_FORMAT) return null;
    if (typeof parsed.key !== 'string' || typeof parsed.signature !== 'string') return null;
    return { key: parsed.key, signature: parsed.signature };
  } catch {
    return null;
  }
}

/**
 * Verifies `filePath` as the release asset called `expectedFilename`.
 * Only the key id and the signature are read from the .sig; the name, size
 * and hash are the ones the app expects and measured, never the .sig's own.
 */
export async function verifyUpdateFile(
  filePath: string,
  expectedFilename: string,
  signatureText: string | null,
  keys: SigningKey[] = BUILTIN_KEYS
): Promise<SignatureResult> {
  if (signatureText == null) return { ok: false, reason: 'missing' };
  const sig = parseSignatureFile(signatureText);
  if (!sig) return { ok: false, reason: 'malformed' };
  const entry = keys.find((k) => k.id === sig.key);
  if (!entry) return { ok: false, reason: 'unknown-key' };

  const { sha256, size } = await hashFile(filePath);
  let valid = false;
  try {
    valid = crypto.verify(
      null,
      signedMessage(expectedFilename, size, sha256),
      crypto.createPublicKey(entry.publicKey),
      Buffer.from(sig.signature, 'base64')
    );
  } catch {
    valid = false;
  }
  return valid ? { ok: true, keyId: entry.id } : { ok: false, reason: 'mismatch' };
}
