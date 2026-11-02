/**
 * Opening the index release's files (indexer/src/clientIndex.ts, format 2):
 * gzip inside age, encrypted to the app's recipient among others. The indexer
 * writes them with its own age code (indexer/src/age.ts, Node built-ins);
 * the app reads with `age-encryption`, because Electron's crypto has no
 * ChaCha20-Poly1305. Tests on both sides read the other's files.
 */

import { gunzip } from 'node:zlib';
import { Decrypter, identityToRecipient } from 'age-encryption';

/** The public `age1…` recipient of an identity. */
export function recipientOf(identity: string): Promise<string> {
  return identityToRecipient(identity);
}

/** age with `identity`, then gunzip. Throws when this identity is not a recipient or the file was altered. */
export async function openAgeGz(file: Buffer, identity: string): Promise<Buffer> {
  const d = new Decrypter();
  d.addIdentity(identity);
  const zipped = await d.decrypt(file, 'uint8array');
  return new Promise((resolve, reject) => gunzip(zipped, (err, out) => (err ? reject(err) : resolve(out))));
}
