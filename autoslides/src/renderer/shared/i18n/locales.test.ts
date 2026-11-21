import { describe, it, expect, afterEach } from 'vitest'
import { i18n, localeTag, setI18nLanguage } from './index'
import en from './locales/en.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'

// vue-i18n compiles a message the first time it is rendered, so a syntax error
// (a bare `@` starts a linked message, `{`/`}`/`|` are syntax too) only throws
// when that one string is shown — `titlebar.aboutDetail`'s `info@ruc.edu.kg`
// sat broken until someone clicked About on Windows. Literal special
// characters must be escaped as `{'@'}`. Rendering every key here catches it.

type Messages = { [key: string]: string | Messages }

function entriesOf(messages: Messages, prefix = ''): Array<[string, string]> {
  return Object.entries(messages).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return typeof v === 'string' ? [[key, v]] : entriesOf(v, key)
  })
}

function placeholdersIn(message: string): string[] {
  return [...new Set(Array.from(message.matchAll(/\{(\w+)\}/g), match => match[1]))].sort()
}

const english = new Map(entriesOf(en))
const locales = { en, zh, ja, ko } as const

afterEach(() => setI18nLanguage('en'))

describe('locale messages', () => {
  for (const [locale, messages] of Object.entries(locales)) {
    it(`${locale}: every message compiles`, () => {
      setI18nLanguage(locale as keyof typeof locales)
      const broken: string[] = []
      for (const [key] of entriesOf(messages)) {
        try {
          i18n.global.t(key)
        } catch (error) {
          broken.push(`${key}: ${String(error)}`)
        }
      }
      expect(broken).toEqual([])
    })

    if (locale !== 'en') {
      it(`${locale}: matches English keys and interpolation parameters`, () => {
        const translated = new Map(entriesOf(messages))
        expect([...translated.keys()].sort()).toEqual([...english.keys()].sort())
        const mismatches = [...english].flatMap(([key, message]) => {
          const expected = placeholdersIn(message).join(', ')
          const actual = placeholdersIn(translated.get(key) ?? '').join(', ')
          return expected === actual ? [] : [`${key}: expected {${expected}}, got {${actual}}`]
        })
        expect(mismatches).toEqual([])
      })
    }
  }
})

describe('English locale', () => {
  const { t } = i18n.global

  it('uses British date and time formatting', () => {
    expect(localeTag()).toBe('en-GB')
  })

  it.each([
    [0, '0 slides', '0 classes'],
    [1, '1 slide', '1 class'],
    [2, '2 slides', '2 classes'],
  ])('selects the correct form for %i using either count or n', (count, slides, classes) => {
    expect(t('playback.slides', { count })).toBe(slides)
    expect(t('yanhe2Calendar.sessionCount', { n: count })).toBe(classes)
  })

  it('selects by the number added, not by the number skipped', () => {
    expect(t('yanhe2Curriculum.downloadsAllSome', { count: 1, skipped: 2 })).toBe(
      'Added 1 download to the download queue. 2 skipped: no recording or already queued.',
    )
    expect(t('yanhe2Curriculum.downloadsAllSome', { count: 2, skipped: 1 })).toBe(
      'Added 2 downloads to the download queue. 1 skipped: no recording or already queued.',
    )
  })

  it('can select by a named count other than count or n', () => {
    expect(t('lectures.renamePartialResult', { failed: 1 }, 1)).toBe(
      '1 file could not be renamed. The others were renamed.',
    )
    expect(t('lectures.renamePartialResult', { failed: 2 }, 2)).toBe(
      '2 files could not be renamed. The others were renamed.',
    )
  })

  it('inflects the pronoun as well as the noun in a confirmation', () => {
    expect(t('titlebar.updateModal.oldFilesMessage', { count: 1 })).toBe(
      'Found 1 old update file in the downloads folder. Would you like to delete it?',
    )
  })
})
