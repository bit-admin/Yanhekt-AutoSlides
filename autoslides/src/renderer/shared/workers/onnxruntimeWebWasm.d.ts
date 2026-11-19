// `onnxruntime-web/wasm` (the plain CPU build the workers import) shares the
// root entry's types.d.ts, but only through package.json `exports`, which
// `moduleResolution: "node"` does not read.
declare module 'onnxruntime-web/wasm' {
  export * from 'onnxruntime-web';
}
