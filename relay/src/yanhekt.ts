/**
 * Port of autoslides/src/shared/crypto.ts — yanhekt anti-hotlink signing.
 * Identical formulas, using the bundled pure-JS MD5 (Web Crypto has no MD5).
 */
import { md5 } from './md5';

export const VIDEO_MAGIC = '1138b69dfef641d9d7ba49137d2d4875';

/** Insert MD5(MAGIC+"_100") as a path segment before the filename. */
export function encryptVideoUrl(url: string): string {
  const urlList = url.split('/');
  const hash = md5(VIDEO_MAGIC + '_100');
  urlList.splice(-1, 0, hash);
  return urlList.join('/');
}

/** Fresh per-request video signature: { timestamp, signature }. */
export function getVideoSignature(): { timestamp: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = md5(VIDEO_MAGIC + '_v1_' + timestamp);
  return { timestamp, signature };
}

/** Append the anti-hotlink query params to an already-encrypted URL. */
export function addSignatureToUrl(
  url: string,
  videoToken: string,
  timestamp: string,
  signature: string
): string {
  return `${url}?Xvideo_Token=${videoToken}&Xclient_Timestamp=${timestamp}&Xclient_Signature=${signature}&Xclient_Version=v1&Platform=yhkt_user`;
}

/** Static client signature used as a request header when minting the video token. */
export function getClientSignature(): string {
  return md5(VIDEO_MAGIC + '_v1_undefined');
}

/** Encrypt + sign a recorded media URL in one step (fresh signature each call). */
export function signMediaUrl(rawUrl: string, videoToken: string): string {
  const { timestamp, signature } = getVideoSignature();
  return addSignatureToUrl(encryptVideoUrl(rawUrl), videoToken, timestamp, signature);
}
