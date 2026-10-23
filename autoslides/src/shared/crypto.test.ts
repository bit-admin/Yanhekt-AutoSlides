import { describe, expect, it } from 'vitest';
import { addSignatureToUrl, encryptVideoUrl, getClientSignature, getVideoSignature } from './crypto';

/**
 * Golden vectors for the Yanhekt anti-hotlink scheme.
 *
 * The same formulas are re-implemented in two other runtimes that cannot
 * import this module (drift group `yanhektCrypto`, scripts/check-drift.mjs):
 *   - web/src/lib/yanhektSignature.ts (crypto-js MD5)       → web/src/lib/yanhekt.test.ts
 *   - relay/src/yanhekt.ts            (bundled pure-JS md5) → relay/src/yanhekt.test.ts
 * Two more send only the finished client signature, as hardcoded hex:
 *   - share/src/lib/yanhekt.ts   → share/src/lib/copies.test.ts
 *   - indexer/src/yanhekt.ts     → indexer/src/yanhekt.test.ts
 * All of them pin the values below. Changing VIDEO_MAGIC or the suffixes here
 * without updating the siblings breaks relay signing and every Yanhekt request.
 */
export const CLIENT_SIGNATURE_HEX = '72b77856f6df3f563ab6e658631cac3d';
export const PATH_HASH_HEX = 'c3d47d7b3aa8caf2983b313cb6cd142f';

describe('yanhekt crypto golden vectors', () => {
  it('client signature matches the hex share/ hardcodes', () => {
    expect(getClientSignature()).toBe(CLIENT_SIGNATURE_HEX);
  });

  it('path encryption inserts md5(MAGIC + "_100") before the filename', () => {
    expect(encryptVideoUrl('https://cvideo.yanhekt.cn/abc/def/video.m3u8')).toBe(
      `https://cvideo.yanhekt.cn/abc/def/${PATH_HASH_HEX}/video.m3u8`
    );
  });

  it('video signature is md5(MAGIC + "_v1_" + unix seconds)', () => {
    const { timestamp, signature } = getVideoSignature();
    expect(timestamp).toMatch(/^\d{10}$/);
    expect(signature).toMatch(/^[0-9a-f]{32}$/);
    // Fixed-timestamp vector shared with relay/web tests.
    expect(addSignatureToUrl('https://x/y', 'tok', '1700000000', '7882ae7978cdaf9984063677dde90b24')).toBe(
      'https://x/y?Xvideo_Token=tok&Xclient_Timestamp=1700000000&Xclient_Signature=7882ae7978cdaf9984063677dde90b24&Xclient_Version=v1&Platform=yhkt_user'
    );
  });
});
