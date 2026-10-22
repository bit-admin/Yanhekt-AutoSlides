import { describe, expect, it } from 'vitest'
import { snapshotRowToCourse, snapshotTermKey } from './courseSnapshotSearch'

describe('snapshotTermKey', () => {
  it('maps an earlier-term picker id to the snapshot key', () => {
    expect(snapshotTermKey(-20231)).toBe('2023-2024-1')
    expect(snapshotTermKey(-20252)).toBe('2025-2026-2')
  })

  it('refuses the current term (a positive Yanhekt tag id) and malformed ids', () => {
    expect(snapshotTermKey(1234)).toBeNull()
    expect(snapshotTermKey(-20233)).toBeNull()
    expect(snapshotTermKey(Number.NaN)).toBeNull()
  })
})

describe('snapshotRowToCourse', () => {
  it('fills the card from the row and the term', () => {
    expect(snapshotRowToCourse({ id: '101', name: '线性代数', teachers: ['张三', '李四'] }, '2023-2024-1')).toMatchObject({
      id: '101',
      title: '线性代数',
      instructor: '张三, 李四',
      school_year: '2023-2024',
      semester: '1',
    })
  })
})
