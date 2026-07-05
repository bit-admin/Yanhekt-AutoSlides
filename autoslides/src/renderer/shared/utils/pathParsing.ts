/**
 * Renderer-side path string parsing (no Node `path` access in the renderer).
 * Handles both POSIX and Windows separators since paths may originate from
 * either platform's file dialogs.
 */

export function isWindowsPath(filePath: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\')
}

/** Split a path into directory, filename stem, and the separator it uses. */
export function getPathParts(filePath: string): { dir: string; stem: string; separator: '/' | '\\' } {
  const lastForwardSlash = filePath.lastIndexOf('/')
  const lastBackwardSlash = filePath.lastIndexOf('\\')
  const slashIndex = Math.max(lastForwardSlash, lastBackwardSlash)

  const separator = slashIndex >= 0
    ? (filePath[slashIndex] as '/' | '\\')
    : (isWindowsPath(filePath) ? '\\' : '/')

  const dir = slashIndex >= 0 ? filePath.slice(0, slashIndex) : ''
  const fileName = slashIndex >= 0 ? filePath.slice(slashIndex + 1) : filePath
  const dotIndex = fileName.lastIndexOf('.')
  const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  return { dir, stem, separator }
}

/** Strip Windows-forbidden filename characters when the target path is a Windows path. */
export function toSafeToken(token: string, filePath: string): string {
  if (!isWindowsPath(filePath)) {
    return token
  }
  return token.replace(/[<>:"/\\|?*]/g, '_')
}
