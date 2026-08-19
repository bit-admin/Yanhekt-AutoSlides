'use strict'

const fs = require('fs')
const path = require('path')

const TYPES = ['png', 'jpg', 'gif', 'webp', 'bmp']
const globalOptions = {
  disabledFS: false,
  disabledTypes: [],
}

function readUInt16BE (input, offset) {
  return (input[offset] << 8) | input[offset + 1]
}

function readUInt16LE (input, offset) {
  return input[offset] | (input[offset + 1] << 8)
}

function readUInt32BE (input, offset) {
  return (
    input[offset] * 2 ** 24 +
    input[offset + 1] * 2 ** 16 +
    input[offset + 2] * 2 ** 8 +
    input[offset + 3]
  )
}

function readUInt32LE (input, offset) {
  return (
    input[offset] +
    input[offset + 1] * 2 ** 8 +
    input[offset + 2] * 2 ** 16 +
    input[offset + 3] * 2 ** 24
  )
}

function isTypeDisabled (type) {
  return globalOptions.disabledTypes.indexOf(type) !== -1
}

function pngSize (input) {
  // \x89PNG\r\n\x1a\n
  if (input.length < 24) return null
  if (input[0] !== 0x89 || input[1] !== 0x50 || input[2] !== 0x4e || input[3] !== 0x47) {
    return null
  }
  if (input[12] === 0x43 && input[13] === 0x67 && input[14] === 0x42 && input[15] === 0x49) {
    // apple-fried CgBI then IHDR
    return { width: readUInt32BE(input, 32), height: readUInt32BE(input, 36), type: 'png' }
  }
  return { width: readUInt32BE(input, 16), height: readUInt32BE(input, 20), type: 'png' }
}

function gifSize (input) {
  if (input.length < 10) return null
  if (input[0] !== 0x47 || input[1] !== 0x49 || input[2] !== 0x46) return null
  return { width: readUInt16LE(input, 6), height: readUInt16LE(input, 8), type: 'gif' }
}

function bmpSize (input) {
  if (input.length < 26) return null
  if (input[0] !== 0x42 || input[1] !== 0x4d) return null
  return { width: readUInt32LE(input, 18), height: Math.abs(readUInt32LE(input, 22)), type: 'bmp' }
}

function webpSize (input) {
  // RIFF....WEBP
  if (input.length < 30) return null
  if (input[0] !== 0x52 || input[1] !== 0x49 || input[2] !== 0x46 || input[3] !== 0x46) return null
  if (input[8] !== 0x57 || input[9] !== 0x45 || input[10] !== 0x42 || input[11] !== 0x50) return null
  const tag = String.fromCharCode(input[12], input[13], input[14], input[15])
  if (tag === 'VP8X') {
    return {
      width: 1 + input[24] + (input[25] << 8) + (input[26] << 16),
      height: 1 + input[27] + (input[28] << 8) + (input[29] << 16),
      type: 'webp',
    }
  }
  if (tag === 'VP8 ') {
    return {
      width: readUInt16LE(input, 26) & 0x3fff,
      height: readUInt16LE(input, 28) & 0x3fff,
      type: 'webp',
    }
  }
  if (tag === 'VP8L') {
    const bits = readUInt32LE(input, 21)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      type: 'webp',
    }
  }
  return null
}

function jpegSize (input) {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null
  let offset = 2
  const len = input.length
  // Cap the walk so a crafted JPEG cannot hang (same class of bug as the
  // dropped ICNS/JXL/HEIF parsers).
  for (let i = 0; i < 4096 && offset + 8 < len; i++) {
    if (input[offset] !== 0xff) {
      throw new TypeError('Invalid JPEG')
    }
    let marker = input[offset + 1]
    while (marker === 0xff) {
      offset++
      if (offset + 8 >= len) throw new TypeError('Invalid JPEG')
      marker = input[offset + 1]
    }
    // SOF0–SOF15 except DHT (C4), JPG (C8), DAC (CC)
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2
      continue
    }
    const size = readUInt16BE(input, offset + 2)
    if (size < 2) throw new TypeError('Invalid JPEG')
    if (sof) {
      return {
        height: readUInt16BE(input, offset + 5),
        width: readUInt16BE(input, offset + 7),
        type: 'jpg',
      }
    }
    offset += 2 + size
  }
  throw new TypeError('Invalid JPEG')
}

function lookup (input) {
  const detectors = [
    ['png', pngSize],
    ['gif', gifSize],
    ['bmp', bmpSize],
    ['webp', webpSize],
    ['jpg', jpegSize],
  ]
  for (const [type, fn] of detectors) {
    if (isTypeDisabled(type)) continue
    const size = fn(input)
    if (size) return size
  }
  throw new TypeError('unsupported file type')
}

function readFileSync (filepath) {
  const descriptor = fs.openSync(filepath, 'r')
  try {
    const { size } = fs.fstatSync(descriptor)
    if (size <= 0) throw new Error('Empty file')
    const inputSize = Math.min(size, 512 * 1024)
    const input = new Uint8Array(inputSize)
    fs.readSync(descriptor, input, 0, inputSize, 0)
    return input
  } finally {
    fs.closeSync(descriptor)
  }
}

function imageSize (input, callback) {
  if (input instanceof Uint8Array) {
    return lookup(input)
  }
  if (typeof input !== 'string' || globalOptions.disabledFS) {
    throw new TypeError('invalid invocation. input should be a Uint8Array')
  }
  const filepath = path.resolve(input)
  if (typeof callback === 'function') {
    fs.promises.readFile(filepath).then((buf) => {
      try {
        callback(null, lookup(buf))
      } catch (err) {
        callback(err)
      }
    }).catch(callback)
    return
  }
  return lookup(readFileSync(filepath))
}

module.exports = exports = imageSize
exports.default = imageSize
exports.imageSize = imageSize
exports.disableFS = (v) => { globalOptions.disabledFS = v }
exports.disableTypes = (types) => { globalOptions.disabledTypes = types }
exports.setConcurrency = () => {}
exports.types = TYPES
