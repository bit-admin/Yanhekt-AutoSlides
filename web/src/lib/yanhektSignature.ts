/**
 * Yanhekt request signature. It is sent to yanhekt, so it must stay
 * byte-identical to the AutoSlides desktop app's (autoslides/src/shared/crypto.ts)
 * and the relay's (relay/src/yanhekt.ts): drift group `yanhektCrypto`
 * (scripts/check-drift.mjs). Golden vector in yanhekt.test.ts.
 */
import CryptoJS from "crypto-js";

const MAGIC = "1138b69dfef641d9d7ba49137d2d4875";

const md5 = (s: string): string => CryptoJS.MD5(s).toString();

/** Constant client signature; the literal "undefined" suffix is mandatory. */
export function getClientSignature(): string {
  return md5(MAGIC + "_v1_undefined");
}
