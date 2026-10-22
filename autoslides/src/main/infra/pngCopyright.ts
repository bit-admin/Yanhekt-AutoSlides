/**
 * Adds the copyright reminder to a PNG as tEXt chunks (`Copyright`,
 * `Disclaimer`, `Software`) right after IHDR, without re-encoding the pixels.
 * Viewers that show file properties (exiftool, Preview's inspector, most image
 * managers) display them.
 *
 * Returns the input unchanged when it is not a PNG or already carries a
 * Copyright chunk, so calling it twice on the same bytes is harmless.
 */
import zlib from 'node:zlib';
import { COPYRIGHT_LONG, COPYRIGHT_SHORT } from '@common/copyrightNotice';

const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

function isPng(buf: Uint8Array): boolean {
  if (buf.length < 33) return false;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) if (buf[i] !== PNG_SIGNATURE[i]) return false;
  return true;
}

/** tEXt is Latin-1; the notice is ASCII, anything else is replaced. */
function latin1(text: string): Buffer {
  return Buffer.from(text.replace(/[^\x20-\x7e]/g, '?'), 'latin1');
}

function textChunk(keyword: string, text: string): Buffer {
  const type = Buffer.from('tEXt', 'ascii');
  const data = Buffer.concat([latin1(keyword), Buffer.of(0), latin1(text)]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([type, data])) >>> 0);
  return Buffer.concat([len, type, data, crc]);
}

/** True if a tEXt/iTXt/zTXt chunk with keyword `Copyright` appears before IDAT. */
function hasCopyrightChunk(buf: Buffer): boolean {
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT' || type === 'IEND') return false;
    if ((type === 'tEXt' || type === 'iTXt' || type === 'zTXt') &&
        buf.toString('latin1', off + 8, off + 8 + 10) === 'Copyright\0') {
      return true;
    }
    off += 12 + len;
  }
  return false;
}

export function withPngCopyright(input: Uint8Array): Uint8Array {
  if (!isPng(input)) return input;
  const buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  // IHDR is always first: 8 signature + 4 len + 4 type + 13 data + 4 crc.
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return input;
  if (hasCopyrightChunk(buf)) return input;
  const afterIhdr = 8 + 12 + buf.readUInt32BE(8);
  return Buffer.concat([
    buf.subarray(0, afterIhdr),
    textChunk('Copyright', COPYRIGHT_SHORT),
    textChunk('Disclaimer', COPYRIGHT_LONG),
    textChunk('Software', 'AutoSlides'),
    buf.subarray(afterIhdr),
  ]);
}
