import * as crypto from 'crypto';

export const VIDEO_MAGIC = '1138b69dfef641d9d7ba49137d2d4875';

export function encryptVideoUrl(url: string): string {
  const urlList = url.split('/');
  const hash = crypto.createHash('md5').update(VIDEO_MAGIC + '_100').digest('hex');
  urlList.splice(-1, 0, hash);
  return urlList.join('/');
}

export function getVideoSignature(): { timestamp: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHash('md5').update(VIDEO_MAGIC + '_v1_' + timestamp).digest('hex');
  return { timestamp, signature };
}

export function addSignatureToUrl(
  url: string,
  videoToken: string,
  timestamp: string,
  signature: string
): string {
  return `${url}?Xvideo_Token=${videoToken}&Xclient_Timestamp=${timestamp}&Xclient_Signature=${signature}&Xclient_Version=v1&Platform=yhkt_user`;
}

export function getClientSignature(): string {
  return crypto.createHash('md5').update(VIDEO_MAGIC + '_v1_undefined').digest('hex');
}
