import { ref } from 'vue'

// Yanhekt CDN banners reused as generic course covers. These live on the same
// origin the app already streams from, so they load fine on the campus network
// (unlike a third-party CDN). Courses have no per-course artwork, so one of
// these is assigned per course and the title is overlaid for identity.
export const coverImages = [
  'https://coss.yanhekt.cn/images/front_cover.png',
  'https://coss.yanhekt.cn/images/colleges/makesi.png',
  'https://coss.yanhekt.cn/images/colleges/qianyanjiaocha.png',
  'https://coss.yanhekt.cn/images/colleges/jisuanji.png',
  'https://coss.yanhekt.cn/images/colleges/fa.png'
]

// djb2-style string hash, shared by cover and avatar-colour selection so both
// are stable for a given id/title across reloads and devices.
const hashString = (value: string): number => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

/**
 * Get the cover image URL for a given course ID. Deterministic: the same id
 * always maps to the same cover, so cards don't reshuffle on reload.
 */
export const getCourseCover = (id?: string | null): string => {
  if (!id) return coverImages[0]
  return coverImages[hashString(id) % coverImages.length]
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
