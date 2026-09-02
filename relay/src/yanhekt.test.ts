import { describe, expect, it } from 'vitest';
import { VIDEO_MAGIC, addSignatureToUrl, encryptVideoUrl, getClientSignature, signMediaUrl } from './yanhekt';

// Golden vectors shared with autoslides/src/shared/crypto.test.ts,
// web/src/lib/yanhekt.test.ts and share/src/lib/yanhekt.ts (hardcoded hex).
const CLIENT_SIGNATURE_HEX = '72b77856f6df3f563ab6e658631cac3d';
const PATH_HASH_HEX = 'c3d47d7b3aa8caf2983b313cb6cd142f';

describe('relay yanhekt signing', () => {
  it('pins the magic and the constant client signature', () => {
    expect(VIDEO_MAGIC).toBe('1138b69dfef641d9d7ba49137d2d4875');
    expect(getClientSignature()).toBe(CLIENT_SIGNATURE_HEX);
  });

  it('encrypts the path exactly like the desktop implementation', () => {
    expect(encryptVideoUrl('https://cvideo.yanhekt.cn/abc/def/video.m3u8')).toBe(
      `https://cvideo.yanhekt.cn/abc/def/${PATH_HASH_HEX}/video.m3u8`
    );
    expect(addSignatureToUrl('https://x/y', 'tok', '1700000000', '7882ae7978cdaf9984063677dde90b24')).toBe(
      'https://x/y?Xvideo_Token=tok&Xclient_Timestamp=1700000000&Xclient_Signature=7882ae7978cdaf9984063677dde90b24&Xclient_Version=v1&Platform=yhkt_user'
    );
  });

  it('signMediaUrl composes encrypt + fresh signature + token', () => {
    const signed = signMediaUrl('https://cvideo.yanhekt.cn/a/b.ts', 'tok');
    expect(signed).toMatch(new RegExp(`^https://cvideo\\.yanhekt\\.cn/a/${PATH_HASH_HEX}/b\\.ts\\?Xvideo_Token=tok&Xclient_Timestamp=\\d{10}&Xclient_Signature=[0-9a-f]{32}&`));
  });
});
