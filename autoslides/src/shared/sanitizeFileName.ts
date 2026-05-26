export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
}
