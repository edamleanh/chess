import { describe, expect, it } from 'vitest'
import type { PositionEval, Score } from '../types'
import { assess, missedMate } from './assessment'

const ev = (score: Score): PositionEval => ({ score, bestMove: null, lines: [], depth: 20 })

describe('assess', () => {
  it.each([
    [{ kind: 'cp', value: 10 }, 'Cân bằng', null],
    [{ kind: 'cp', value: 80 }, 'Trắng nhỉnh hơn', 'w'],
    [{ kind: 'cp', value: -200 }, 'Đen ưu thế', 'b'],
    [{ kind: 'cp', value: 600 }, 'Trắng thắng thế áp đảo', 'w'],
    [{ kind: 'mate', value: 3 }, 'Trắng chiếu hết sau 3 nước', 'w'],
    [{ kind: 'mate', value: -1 }, 'Đen chiếu hết sau 1 nước', 'b'],
    [{ kind: 'gameover', outcome: 'loss' }, 'Chiếu hết · Đen thắng', 'b'],
    [{ kind: 'gameover', outcome: 'draw' }, 'Hòa', null],
  ] as [Score, string, string | null][])('%o → %s', (score, text, side) => {
    expect(assess(score)).toMatchObject({ text, side })
  })

  it('mateIn chỉ có khi là đòn chiếu hết', () => {
    expect(assess({ kind: 'mate', value: -4 }).mateIn).toBe(4)
    expect(assess({ kind: 'cp', value: 900 }).mateIn).toBeNull()
  })
})

describe('missedMate', () => {
  it('Trắng có M3 nhưng đi nước làm mất chiếu hết → 3', () => {
    expect(missedMate(ev({ kind: 'mate', value: 3 }), ev({ kind: 'cp', value: 800 }), 'w')).toBe(3)
  })

  it('Đen có chiếu hết (mate âm theo góc nhìn Trắng) và bỏ lỡ', () => {
    expect(missedMate(ev({ kind: 'mate', value: -2 }), ev({ kind: 'cp', value: -300 }), 'b')).toBe(2)
  })

  it('vẫn giữ chiếu hết hoặc đã chiếu hết → null', () => {
    expect(missedMate(ev({ kind: 'mate', value: 3 }), ev({ kind: 'mate', value: 2 }), 'w')).toBeNull()
    expect(missedMate(ev({ kind: 'mate', value: 1 }), ev({ kind: 'gameover', outcome: 'win' }), 'w')).toBeNull()
  })

  it('không có chiếu hết, hoặc là bên bị chiếu hết → null', () => {
    expect(missedMate(ev({ kind: 'cp', value: 500 }), ev({ kind: 'cp', value: 0 }), 'w')).toBeNull()
    expect(missedMate(ev({ kind: 'mate', value: -3 }), ev({ kind: 'mate', value: -2 }), 'w')).toBeNull()
  })
})
