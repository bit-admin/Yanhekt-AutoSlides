// Electron rejects `ipcRenderer.invoke` with the main-process error wrapped as
// "Error invoking remote method '<channel>': Error: <message>". That prefix is
// for developers, not people, so the preload strips it from every rejection
// (`src/preload/invoke.ts`) and screens show only "<message>".

const IPC_WRAPPER = /^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

/** Error text without Electron's IPC wrapper, for display. */
export function userFacingIpcError(error: unknown): string {
  const message = messageOf(error) || String(error)
  return message.replace(IPC_WRAPPER, '')
}
