import { describe, expect, it } from 'vitest'
import { parseSessionInput } from './sessionInput'

describe('parseSessionInput', () => {
  it('accepts a bare session id', () => {
    expect(parseSessionInput(' 901560 ')).toEqual({ kind: 'session', sessionId: '901560' })
  })

  it('accepts a session URL with or without scheme', () => {
    expect(parseSessionInput('https://www.yanhekt.cn/session/901560')).toEqual({ kind: 'session', sessionId: '901560' })
    expect(parseSessionInput('www.yanhekt.cn/session/901560/')).toEqual({ kind: 'session', sessionId: '901560' })
    expect(parseSessionInput('https://yanhekt.cn/session/901560?tab=note')).toEqual({ kind: 'session', sessionId: '901560' })
  })

  it('recognises a course URL so the caller can reject it', () => {
    expect(parseSessionInput('https://www.yanhekt.cn/course/64333')).toEqual({ kind: 'course', courseId: '64333' })
  })

  it('rejects other hosts and shapes', () => {
    expect(parseSessionInput('https://example.com/session/901560')).toEqual({ kind: 'invalid' })
    expect(parseSessionInput('https://notyanhekt.cn/session/1')).toEqual({ kind: 'invalid' })
    expect(parseSessionInput('https://www.yanhekt.cn/live/901560')).toEqual({ kind: 'invalid' })
    expect(parseSessionInput('https://www.yanhekt.cn/session/90x')).toEqual({ kind: 'invalid' })
    expect(parseSessionInput('abc')).toEqual({ kind: 'invalid' })
    expect(parseSessionInput('   ')).toEqual({ kind: 'empty' })
  })
})
