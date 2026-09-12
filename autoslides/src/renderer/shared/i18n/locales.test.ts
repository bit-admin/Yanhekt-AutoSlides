import { describe, it, expect, afterEach } from 'vitest'
import { i18n, setI18nLanguage } from './index'
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

function keysOf(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return typeof v === 'string' ? [key] : keysOf(v, key)
  })
}

const locales = { en, zh, ja, ko } as const

afterEach(() => setI18nLanguage('en'))

describe('locale messages', () => {
  for (const [locale, messages] of Object.entries(locales)) {
    it(`${locale}: every message compiles`, () => {
      setI18nLanguage(locale as keyof typeof locales)
      const broken: string[] = []
      for (const key of keysOf(messages as Messages)) {
        try {
          i18n.global.t(key)
        } catch (error) {
          broken.push(`${key}: ${String(error)}`)
        }
      }
      expect(broken).toEqual([])
    })
  }
})
