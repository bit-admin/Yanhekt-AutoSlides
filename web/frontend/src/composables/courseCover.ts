import { ref } from 'vue'

/** Sole fallback when the API omits / empties image_url (or live img). */
export const DEFAULT_COURSE_COVER = 'https://coss.yanhekt.cn/images/front_cover.png'

/**
 * Resolve a course cover URL. Prefer the API-provided image; empty/whitespace
 * falls back to the Yanhekt default front cover (not a hashed college banner).
 */
export const resolveCourseCover = (imageUrl?: string | null): string => {
  const trimmed = imageUrl?.trim()
  return trimmed ? trimmed : DEFAULT_COURSE_COVER
}

// djb2-style string hash for avatar-colour selection (stable per title).
const hashString = (value: string): number => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

// Track courses that failed to load their cover image, falling back to the svg
// placeholder.
export const coverFailed = ref(new Set<string>())

export const markCoverFailed = (id: string): void => {
  coverFailed.value.add(id)
  coverFailed.value = new Set(coverFailed.value)
}

/**
 * Font size (container-query units) for the title overlaid on a cover,
 * scaled by character count so long titles stay inside the card.
 */
export const getOverlayTextStyle = (title?: string | null) => {
  if (!title) return { fontSize: '8cqw' }
  const len = title.trim().length

  let fontSize = '7cqw'
  if (len <= 4) {
    fontSize = '14cqw'
  } else if (len <= 8) {
    fontSize = '11cqw'
  } else if (len <= 12) {
    fontSize = '8.5cqw'
  }

  return { fontSize }
}

// Distinct, evenly-spaced hues for identicon-style avatars.
const AVATAR_COLORS = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#009688', '#4caf50',
  '#ff9800', '#ff5722', '#795548', '#607d8b'
]

/** Deterministic avatar background colour for a course title or instructor name. */
export const getAvatarBg = (title: string): string =>
  AVATAR_COLORS[hashString(title) % AVATAR_COLORS.length]

/**
 * Up to two initials for an avatar. Splits on whitespace and the punctuation
 * commonly separating a Chinese course title from its teacher (`- : ： －`),
 * so both "Zhang San" and "高等数学：李四" yield sensible initials.
 */
export const getInitials = (title: string): string => {
  const name = title.trim()
  if (!name) return 'U'
  const parts = name.split(/[\s\-:：－]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}
