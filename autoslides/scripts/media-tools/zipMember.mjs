// Reads named members out of a zip with Node's zlib only. Media tools come as
// checksum-pinned zips and only the members the manifest names are wanted, so
// this never unpacks a tree: it writes no archive path, link or folder to disk.
import zlib from 'node:zlib';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
// The EOCD record is 22 bytes plus a comment of at most 65535.
const EOCD_SEARCH = 22 + 0xffff;
const MAX_MEMBER_BYTES = 1024 * 1024 * 1024;
const S_IFMT = 0o170000;
const S_IFREG = 0o100000;

function fail(message) {
  throw new Error(`Zip archive: ${message}`);
}

function findEndOfCentralDirectory(zip) {
  const stop = Math.max(0, zip.length - EOCD_SEARCH);
  for (let offset = zip.length - 22; offset >= stop; offset--) {
    if (zip.readUInt32LE(offset) === EOCD) return offset;
  }
  return fail('no end of central directory record');
}

/** Every entry in the central directory, keyed by its exact name. */
export function listZipEntries(zip) {
  const end = findEndOfCentralDirectory(zip);
  const count = zip.readUInt16LE(end + 10);
  const size = zip.readUInt32LE(end + 12);
  const start = zip.readUInt32LE(end + 16);
  if (count === 0xffff || size === 0xffffffff || start === 0xffffffff) fail('zip64 is not supported');
  if (start + size > end) fail('central directory overlaps its end record');
  const entries = new Map();
  let offset = start;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || zip.readUInt32LE(offset) !== CENTRAL) fail(`bad central directory entry ${index}`);
    const nameLength = zip.readUInt16LE(offset + 28);
    const next = offset + 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
    if (next > end) fail(`central directory entry ${index} runs past the directory`);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (entries.has(name)) fail(`duplicate member ${name}`);
    entries.set(name, {
      name,
      madeBy: zip.readUInt16LE(offset + 4) >> 8,
      flags: zip.readUInt16LE(offset + 8),
      method: zip.readUInt16LE(offset + 10),
      crc: zip.readUInt32LE(offset + 16),
      compressedSize: zip.readUInt32LE(offset + 20),
      size: zip.readUInt32LE(offset + 24),
      mode: zip.readUInt32LE(offset + 38) >>> 16,
      localOffset: zip.readUInt32LE(offset + 42),
    });
    offset = next;
  }
  return entries;
}

/** The bytes of one regular-file member, checked against its size and CRC-32. */
export function readZipMember(zip, entries, name) {
  const entry = entries.get(name);
  if (!entry) fail(`missing member ${name}`);
  if (name.endsWith('/')) fail(`${name} is a folder`);
  // Unix-made entries carry a file type: anything but a regular file (a
  // symlink above all) is refused. Other hosts store no type bits.
  if (entry.madeBy === 3 && entry.mode !== 0 && (entry.mode & S_IFMT) !== S_IFREG) fail(`${name} is not a regular file`);
  if (entry.flags & 1) fail(`${name} is encrypted`);
  if (entry.size > MAX_MEMBER_BYTES) fail(`${name} is larger than ${MAX_MEMBER_BYTES} bytes`);
  const local = entry.localOffset;
  if (local + 30 > zip.length || zip.readUInt32LE(local) !== LOCAL) fail(`bad local header for ${name}`);
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const data = zip.subarray(start, start + entry.compressedSize);
  if (data.length !== entry.compressedSize) fail(`${name} runs past the end of the archive`);
  let bytes;
  if (entry.method === 0) bytes = data;
  else if (entry.method === 8) {
    try {
      // maxOutputLength stops a member that inflates past its declared size.
      bytes = zlib.inflateRawSync(data, { maxOutputLength: Math.max(1, entry.size) });
    } catch (error) {
      fail(`${name} does not inflate to its declared size (${error.code ?? error.message})`);
    }
  } else fail(`${name} uses unsupported compression method ${entry.method}`);
  if (bytes.length !== entry.size) fail(`${name} is ${bytes.length} bytes, expected ${entry.size}`);
  if (zlib.crc32(bytes) !== entry.crc) fail(`${name} fails its CRC-32 check`);
  return bytes;
}
