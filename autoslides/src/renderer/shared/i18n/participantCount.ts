/** A participant count safe to pluralize, or null when the API or a cached pin has no usable number. */
export function participantCount(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return null
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 ? count : null
}
