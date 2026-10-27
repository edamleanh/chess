import { describe, expect, it } from 'vitest'
import { EMPTY_STATS, parseStats, recordResult } from './stats'

describe('stats', () => {
  it('chuỗi đúng và chuỗi dài nhất', () => {
    let s = EMPTY_STATS
    s = recordResult(s, true)
    s = recordResult(s, true)
    s = recordResult(s, false)
    s = recordResult(s, true)
    expect(s).toEqual({ solved: 3, attempted: 4, streak: 1, bestStreak: 2 })
  })

  it('parseStats chịu được dữ liệu hỏng', () => {
    expect(parseStats(null)).toEqual(EMPTY_STATS)
    expect(parseStats('{oops')).toEqual(EMPTY_STATS)
    expect(parseStats('42')).toEqual(EMPTY_STATS)
    expect(parseStats('{"solved":5,"attempted":"x","streak":-1,"bestStreak":7}')).toEqual({
      solved: 5,
      attempted: 0,
      streak: 0,
      bestStreak: 7,
    })
  })
})
