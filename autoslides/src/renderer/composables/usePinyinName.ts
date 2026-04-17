import { computed, type Ref } from 'vue'
import { pinyin } from 'pinyin-pro'

const HAN_RE = /\p{Script=Han}/u

const COMPOUND_SURNAMES = new Set([
  '欧阳', '司马', '诸葛', '上官', '夏侯', '东方', '公孙', '慕容',
  '令狐', '长孙', '皇甫', '南宫', '宇文', '申屠', '独孤', '轩辕', '端木'
])

export function toPinyinName(name: string): string {
  const surnameLen = COMPOUND_SURNAMES.has(name.substring(0, 2)) ? 2 : 1
  const surname = name.substring(0, surnameLen)
  const given = name.substring(surnameLen)

  const surnamePinyin = (pinyin(surname, { toneType: 'none', type: 'array' }) as string[])
    .join('')
    .toUpperCase()

  if (!given) return surnamePinyin

  const givenPinyin = (pinyin(given, { toneType: 'none', type: 'array' }) as string[])
    .join('')
    .toUpperCase()

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
