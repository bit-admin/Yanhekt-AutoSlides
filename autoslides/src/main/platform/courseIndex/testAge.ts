// Test helpers: write index files the way the indexer does (gzip, then age).
// The indexer uses its own age code; these use the app's library, and the
// fixture in courseIndex.test.ts checks the indexer's own output.
import { gzipSync } from 'node:zlib';
import { Encrypter, generateIdentity, identityToRecipient } from 'age-encryption';

export async function newIdentity(): Promise<{ identity: string; recipient: string }> {
  const identity = await generateIdentity();
  return { identity, recipient: await identityToRecipient(identity) };
}

export async function sealAgeGz(plain: Buffer, recipients: string[]): Promise<Buffer> {
  const e = new Encrypter();
  for (const r of recipients) e.addRecipient(r);
  return Buffer.from(await e.encrypt(gzipSync(plain)));
}
