// Output-folder problems as a cross-process signal.
//
// `ipcMain.handle` rejections reach the renderer as a plain message wrapped in
// "Error invoking remote method '<channel>': Error: <message>" — `error.code`
// (EPERM/ENOENT) does not survive. Main therefore rethrows an unusable output
// folder with a stable marker in the message, and the renderer parses it back.
//
// - `denied`      — the folder exists but may not be read. On macOS the usual
//                   cause is privacy protection on ~/Downloads (the default).
// - `missing`     — the folder is gone but can safely be created again.
// - `unreachable` — the folder is gone and so is its parent outside the home
//                   folder: most likely a disconnected drive. Never recreated,
//                   or we would plant a fake mount point under /Volumes.

export type OutputDirProblemKind = 'denied' | 'missing' | 'unreachable'

const MARKER = 'AUTOSLIDES_OUTPUT_DIR'
const KINDS: readonly OutputDirProblemKind[] = ['denied', 'missing', 'unreachable']

export function formatOutputDirProblem(kind: OutputDirProblemKind, dir: string): string {
  return `${MARKER}:${kind}:${dir}`
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

/** `{ kind, dir }` when the error (raw or IPC-wrapped) carries the marker. */
export function parseOutputDirProblem(error: unknown): { kind: OutputDirProblemKind; dir: string } | null {
  const message = messageOf(error)
  const at = message.indexOf(`${MARKER}:`)
  if (at === -1) return null
  const rest = message.slice(at + MARKER.length + 1)
  const sep = rest.indexOf(':')
  if (sep === -1) return null
  const kind = rest.slice(0, sep) as OutputDirProblemKind
  if (!KINDS.includes(kind)) return null
  return { kind, dir: rest.slice(sep + 1).trim() }
}

const IPC_WRAPPER = /^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/

/** Error text without Electron's IPC wrapper, for display. */
export function userFacingIpcError(error: unknown): string {
  const message = messageOf(error) || String(error)
  return message.replace(IPC_WRAPPER, '')
}
