import { computed, type Ref } from 'vue'
import { pinyin } from 'pinyin-pro'

const HAN_RE = /\p{Script=Han}/u
const MIDDLE_DOT_RE = /[·・]/u
const MIDDLE_DOT_SPLIT_RE = /\s*[·・]\s*/u

const COMPOUND_SURNAMES = new Set([
  '欧阳', '司马', '诸葛', '上官', '夏侯', '东方', '公孙', '慕容',
  '令狐', '长孙', '皇甫', '南宫', '宇文', '申屠', '独孤', '轩辕', '端木'
])

function toTitleCase(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

function toPinyinPart(value: string): string {
  return toTitleCase(
    (pinyin(value, { toneType: 'none', type: 'array' }) as string[]).join('')
  )
}

export function toPinyinName(name: string): string {
  if (MIDDLE_DOT_RE.test(name)) {
    const parts = name.split(MIDDLE_DOT_SPLIT_RE).map(part => part.trim()).filter(Boolean)
    if (parts.length > 0) {
      return parts.map(toPinyinPart).join(' ')
    }
  }

  const surnameLen = COMPOUND_SURNAMES.has(name.substring(0, 2)) ? 2 : 1
  const surname = name.substring(0, surnameLen)
  const given = name.substring(surnameLen)

  const surnamePinyin = toPinyinPart(surname)

  if (!given) return surnamePinyin

  const givenPinyin = toPinyinPart(given)

  return `${surnamePinyin} ${givenPinyin}`
}

export function toDisplayName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  return HAN_RE.test(trimmed) ? toPinyinName(trimmed) : trimmed
}

export function usePinyinName(nickname: Ref<string>) {
  const isChineseName = computed(() => HAN_RE.test(nickname.value))

  const displayNickname = computed(() => {
    const name = nickname.value.trim()
    if (!name) return ''
    return isChineseName.value ? toPinyinName(name) : name
  })

  const nameInitial = computed(() => {
    const name = displayNickname.value
    return name ? name.charAt(0).toUpperCase() : 'U'
  })

  return { isChineseName, displayNickname, nameInitial }
}
