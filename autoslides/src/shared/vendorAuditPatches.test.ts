import { createRequire } from 'node:module'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { crc32 } from 'node:zlib'
import { describe, it, expect } from 'vitest'

const require = createRequire(import.meta.url)
const extractZip = require('../../vendor/extract-zip') as (
  zipPath: string,
  opts: { dir: string },
) => Promise<void>
const imageSize = require('../../vendor/image-size') as ((
  input: Uint8Array | string,
) => { width: number; height: number; type?: string }) & {
  types: string[]
}

function u16 (n: number): Buffer {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n)
  return b
}

function u32 (n: number): Buffer {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0)
  return b
}

function buildStoredZip (
  entries: Array<{ name: string; data: Buffer; symlink?: boolean }>,
): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const data = entry.data
    const crc = crc32(data)
    const local = Buffer.concat([
      Buffer.from('PK\x03\x04'),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ])
    const madeBy = entry.symlink ? (3 << 8) | 20 : 20
    const extAttr = entry.symlink ? ((0o120777 * 65536) >>> 0) : ((0o100644 * 65536) >>> 0)
    const central = Buffer.concat([
      Buffer.from('PK\x01\x02'),
      u16(madeBy),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(extAttr),
      u32(offset),
      name,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const localBuf = Buffer.concat(locals)
  const centralBuf = Buffer.concat(centrals)
  const eocd = Buffer.concat([
    Buffer.from('PK\x05\x06'),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralBuf.length),
    u32(localBuf.length),
    u16(0),
  ])
  return Buffer.concat([localBuf, centralBuf, eocd])
}

describe('vendor extract-zip (GHSA-jmr9-qjv8-65gv)', () => {
  async function withTempDir<T> (fn: (dir: string) => Promise<T>): Promise<T> {
    const dir = await mkdtemp(path.join(tmpdir(), 'extract-zip-'))
    try {
      return await fn(dir)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  it('extracts a regular file', async () => {
    await withTempDir(async (dir) => {
      const zipPath = path.join(dir, 'in.zip')
      const out = path.join(dir, 'out')
      await writeFile(zipPath, buildStoredZip([
        { name: 'hello.txt', data: Buffer.from('hello') },
      ]))
      await extractZip(zipPath, { dir: out })
      expect(readFileSync(path.join(out, 'hello.txt'), 'utf8')).toBe('hello')
    })
  })

  it('rejects zip-slip paths before mkdir', async () => {
    await withTempDir(async (dir) => {
      const zipPath = path.join(dir, 'in.zip')
      const out = path.join(dir, 'out')
      await writeFile(zipPath, buildStoredZip([
        { name: '../escape.txt', data: Buffer.from('nope') },
      ]))
      // yauzl itself rejects `..` path segments; our dest check is defense in
      // depth if a parser ever lets one through.
      await expect(extractZip(zipPath, { dir: out })).rejects.toThrow(/Out of bound|invalid relative path/)
      expect(existsSync(path.join(dir, 'escape.txt'))).toBe(false)
    })
  })

  it('rejects symlink targets that resolve outside the extract root', async () => {
    await withTempDir(async (dir) => {
      const zipPath = path.join(dir, 'in.zip')
      const out = path.join(dir, 'out')
      await writeFile(zipPath, buildStoredZip([
        { name: 'link', data: Buffer.from('../../outside.txt'), symlink: true },
      ]))
      await expect(extractZip(zipPath, { dir: out })).rejects.toThrow(/symlink target|Out of bound/)
    })
  })

  it('rejects absolute symlink targets', async () => {
    await withTempDir(async (dir) => {
      const zipPath = path.join(dir, 'in.zip')
      const out = path.join(dir, 'out')
      await writeFile(zipPath, buildStoredZip([
        { name: 'link', data: Buffer.from('/tmp/absolute-target'), symlink: true },
      ]))
      await expect(extractZip(zipPath, { dir: out })).rejects.toThrow(/Absolute symlink|Out of bound/)
    })
  })

  it('allows a relative in-tree symlink', async () => {
    await withTempDir(async (dir) => {
      const zipPath = path.join(dir, 'in.zip')
      const out = path.join(dir, 'out')
      await writeFile(zipPath, buildStoredZip([
        { name: 'target.txt', data: Buffer.from('ok') },
        { name: 'alias', data: Buffer.from('target.txt'), symlink: true },
      ]))
      try {
        await extractZip(zipPath, { dir: out })
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === 'EPERM' || code === 'EACCES') return
        throw err
      }
      expect(readFileSync(path.join(out, 'target.txt'), 'utf8')).toBe('ok')
      const alias = path.join(out, 'alias')
      if (existsSync(alias)) {
        expect(readFileSync(alias, 'utf8')).toBe('ok')
      }
    })
  })
})

describe('vendor image-size (GHSA-w3rx-r6r6-pgpr / GHSA-5p2g-fcmc-qvqq)', () => {
  const PNG_1X1 = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
    'hex',
  )

  it('reports PNG dimensions', () => {
    const size = imageSize(new Uint8Array(PNG_1X1))
    expect(size).toEqual({ width: 1, height: 1, type: 'png' })
  })

  it('does not hang on ICNS with a zero-length entry', () => {
    const icns = Buffer.alloc(16)
    icns.write('icns', 0)
    icns.writeUInt32BE(16, 4)
    icns.write('ICON', 8)
    icns.writeUInt32BE(0, 12)
    expect(() => imageSize(new Uint8Array(icns))).toThrow(/unsupported file type/)
  })

  it('does not hang on a JXL container with a zero-size jxlp box', () => {
    const jxl = Buffer.alloc(32)
    jxl.write('JXL ', 4)
    expect(() => imageSize(new Uint8Array(jxl))).toThrow(/unsupported file type/)
  })

  it('does not list the unpatched parsers', () => {
    expect(imageSize.types).toEqual(['png', 'jpg', 'gif', 'webp', 'bmp'])
  })
})
