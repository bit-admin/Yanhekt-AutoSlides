/**
 * The registrar's course number (Yanhekt `number`, Yanhe 2.0 `kcwybm`) as a
 * non-empty string, else undefined: Yanhekt sends null or '' for a course
 * without one. Pure, so any course module can import it.
 */
export const courseNumberOf = (value: unknown): string | undefined =>
  value === undefined || value === null || String(value).trim() === '' ? undefined : String(value)
