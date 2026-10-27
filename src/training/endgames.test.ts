import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { ENDGAMES, endgameResult, randomEndgame, seededRandom, type EndgameKind } from './endgames'

const KINDS = Object.keys(ENDGAMES) as EndgameKind[]

describe('randomEndgame', () => {
  it.each(KINDS)('%s: 250 thế cờ hợp lệ, đúng bộ quân', (kind) => {
    const random = seededRandom(42)
    for (let i = 0; i < 250; i++) {
      const fen = randomEndgame(kind, random)
      const chess = new Chess(fen)
      expect(chess.turn()).toBe('w')
      expect(chess.isGameOver()).toBe(false)
      const pieces = chess.board().flat().filter((p) => p !== null)
      const white = pieces.filter((p) => p.color === 'w' && p.type !== 'k').map((p) => p.type).sort()
      expect(white).toEqual([...ENDGAMES[kind].pieces].sort())
      expect(pieces.filter((p) => p.color === 'b').map((p) => p.type)).toEqual(['k'])
      // Đen không bị chiếu khi Trắng tới lượt
      const blackKing = pieces.find((p) => p.color === 'b')!.square
      expect(chess.isAttacked(blackKing, 'w')).toBe(false)
      // Vua Đen không ở mép
      expect('ah'.includes(blackKing[0]) || '18'.includes(blackKing[1])).toBe(false)
      // Không bị mất quân bắt buộc ngay nước đầu
      expect(
        chess.moves({ verbose: true }).some((m) => {
          const after = new Chess(fen)
          after.move(m.lan)
          return !after.moves({ verbose: true }).some((r) => r.captured)
        }),
      ).toBe(true)
      if (kind === 'KBB') {
        const colors = pieces.filter((p) => p.type === 'b').map((p) => chess.squareColor(p.square))
        expect(new Set(colors).size).toBe(2)
      }
    }
  })

  it('cùng seed thì cùng kết quả', () => {
    expect(randomEndgame('KQ', seededRandom(7))).toBe(randomEndgame('KQ', seededRandom(7)))
  })
})

describe('endgameResult', () => {
  it('chiếu hết là thắng', () => {
    expect(endgameResult('7k/8/6K1/8/8/8/8/Q7 w - - 0 1', ['a1a8'])).toBe('win')
  })

  it('hòa pat là hòa', () => {
    expect(endgameResult('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', ['g1g6'])).toBe('draw')
  })

  it('Đen ăn mất quân thì hòa (không đủ quân)', () => {
    expect(endgameResult('7K/8/8/8/8/8/1k6/2Q5 w - - 0 1', ['c1c2', 'b2c2'])).toBe('draw')
  })

  it('chưa kết thúc', () => {
    expect(endgameResult('7k/8/6K1/8/8/8/8/Q7 w - - 0 1', ['a1b1'])).toBeNull()
  })
})
