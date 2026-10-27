import { describe, expect, it } from 'vitest'
import { clampPly, fenAt, lastMoveAt } from './navigation'
import { parsePgn } from './parsePgn'

const parsed = parsePgn('1. e4 e5 2. Nf3 *')
if (!parsed.ok) throw new Error(parsed.error)
const game = parsed.game

describe('clampPly', () => {
  it('giữ ply trong [0, total]', () => {
    expect(clampPly(-1, 3)).toBe(0)
    expect(clampPly(2, 3)).toBe(2)
    expect(clampPly(9, 3)).toBe(3)
  })
})

describe('fenAt / lastMoveAt', () => {
  it('ply 0 là thế cờ ban đầu, chưa có nước vừa đi', () => {
    expect(fenAt(game, 0)).toBe(game.startFen)
    expect(lastMoveAt(game, 0)).toBeNull()
  })

  it('ply k là thế cờ sau nước thứ k', () => {
    expect(fenAt(game, 2)).toBe(game.plies[1].fenAfter)
    expect(lastMoveAt(game, 2)?.san).toBe('e5')
  })

  it('ply vượt quá thì kẹp về cuối ván', () => {
    expect(fenAt(game, 99)).toBe(game.plies[2].fenAfter)
  })
})
