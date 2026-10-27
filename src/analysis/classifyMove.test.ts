import { describe, expect, it } from 'vitest'
import { parsePgn } from '../chess/parsePgn'
import { SAMPLE_PGN } from '../chess/samplePgn'
import type { Ply, PositionEval, Score } from '../types'
import { classifyMove } from './classifyMove'
import { negateScore, scoreForMover } from './perspective'

const cp = (value: number): Score => ({ kind: 'cp', value })
const mate = (value: number): Score => ({ kind: 'mate', value })

function ev(score: Score, bestMove: string | null = 'a1a1', second?: Score): PositionEval {
  return { score, bestMove, lines: second ? [{ score, pv: [] }, { score: second, pv: [] }] : [{ score, pv: [] }], depth: 20 }
}

function plies(pgn: string): Ply[] {
  const parsed = parsePgn(pgn)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.game.plies
}

const [e4, e5] = plies('1. e4 e5 *')

describe('scoreForMover', () => {
  it('Trắng giữ nguyên, Đen đảo dấu', () => {
    expect(scoreForMover(cp(30), 'w')).toEqual(cp(30))
    expect(scoreForMover(cp(30), 'b')).toEqual(cp(-30))
    expect(negateScore(mate(2))).toEqual(mate(-2))
  })
})

describe('classifyMove: theo mức tụt win%', () => {
  // Trắng đi e4 từ thế cân bằng; eval sau nước đi (góc nhìn Trắng) quyết định nhãn
  it.each([
    [-20, 'excellent'], // drop ≈ 1.8
    [-50, 'good'], // ≈ 4.6
    [-100, 'inaccuracy'], // ≈ 9.1
    [-150, 'mistake'], // ≈ 13.5
    [-200, 'mistake'], // ≈ 17.6 (chess.com: Blunder từ 0.20)
    [-250, 'blunder'], // ≈ 21.5
  ] as const)('Trắng: eval sau %i cp → %s', (after, expected) => {
    expect(classifyMove(e4, ev(cp(0)), ev(cp(after))).class).toBe(expected)
  })

  it('đối xứng: Đen tụt cùng mức thì cùng nhãn (eval ngược dấu)', () => {
    expect(classifyMove(e5, ev(cp(0)), ev(cp(250))).class).toBe('blunder')
    expect(classifyMove(e5, ev(cp(0)), ev(cp(100))).class).toBe('inaccuracy')
    const r = classifyMove(e5, ev(cp(0)), ev(cp(-300)))
    expect(r.drop).toBe(0)
    expect(r.accuracy).toBe(100)
  })

  it('Best: trùng nước tốt nhất của engine', () => {
    expect(classifyMove(e4, ev(cp(30), 'e2e4'), ev(cp(25))).class).toBe('best')
  })

  it('nước chiếu hết: winAfter = 100; hòa pat: winAfter = 50', () => {
    const win = classifyMove(e4, ev(mate(1), 'e2e4'), ev({ kind: 'gameover', outcome: 'win' }, null))
    expect(win).toMatchObject({ winAfter: 100, class: 'best' })
    const draw = classifyMove(e5, ev(cp(-800)), ev({ kind: 'gameover', outcome: 'draw' }, null))
    expect(draw.winAfter).toBe(50)
  })
})

describe('classifyMove: Great và Brilliant', () => {
  it('Great: nước tốt nhất, mọi nước khác rơi xuống vùng kết quả tệ hơn', () => {
    // biến 1 thắng (+3, win 75), biến 2 chỉ cân bằng (0): nước quyết định
    expect(classifyMove(e4, ev(cp(300), 'e2e4', cp(0)), ev(cp(300))).class).toBe('great')
    // cứu thế thua: biến 1 cân bằng, biến 2 thua (-4, win 19)
    expect(classifyMove(e4, ev(cp(0), 'e2e4', cp(-400)), ev(cp(0))).class).toBe('great')
    // cách biệt lớn nhưng cùng vùng (cân bằng): chỉ là Best
    expect(classifyMove(e4, ev(cp(100), 'e2e4', cp(-100)), ev(cp(100))).class).toBe('best')
  })

  it('Great không áp dụng cho nước chiếu hết và nước ăn lại quân', () => {
    const [, , , , , , qxf7] = plies('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0')
    expect(classifyMove(qxf7, ev(mate(1), 'h5f7', cp(-100)), ev({ kind: 'gameover', outcome: 'win' }, null)).class).toBe(
      'best',
    )
    const all = plies('1. e4 d5 2. exd5 Qxd5 *')
    const [exd5, qxd5] = [all[2], all[3]]
    expect(classifyMove(qxd5, ev(cp(100), 'd8d5', cp(400)), ev(cp(0)), { previous: exd5 }).class).toBe('best')
  })

  it('tận dụng nước dở của đối phương bằng nước duy nhất giữ thế thắng: Great (như chess.com)', () => {
    const before = ev(cp(300), 'e2e4', cp(0))
    expect(classifyMove(e4, before, ev(cp(300)), { previousClass: 'blunder' }).class).toBe('great')
  })
})

describe('classifyMove: Miss (bỏ lỡ cơ hội)', () => {
  // Đen đi e5: trước nước đi Đen đang thắng (-3, win của Đen 75) nhờ đối phương vừa đi dở
  const chance = ev(cp(-300), 'g8f6')

  it('đối phương vừa đi dở, nước này làm rơi về cân bằng → Miss (kể cả khi tụt hơn ngưỡng Blunder)', () => {
    expect(classifyMove(e5, chance, ev(cp(0)), { previousClass: 'blunder' }).class).toBe('miss')
    expect(classifyMove(e5, chance, ev(cp(0)), { previousClass: 'mistake' }).class).toBe('miss')
  })

  it('đối phương không đi dở → chấm theo mức tụt như thường', () => {
    expect(classifyMove(e5, chance, ev(cp(0)), { previousClass: 'good' }).class).toBe('blunder')
    expect(classifyMove(e5, chance, ev(cp(0))).class).toBe('blunder')
  })

  it('vẫn giữ vùng thắng → không phải Miss', () => {
    // 75 → 71.5: tụt ~3.6 nhưng vẫn ở vùng thắng
    expect(classifyMove(e5, chance, ev(cp(-250)), { previousClass: 'blunder' }).class).toBe('good')
  })

  it('Đen chiếu hết: winAfter = 100 theo góc nhìn Đen', () => {
    const r = classifyMove(e5, ev(mate(-1), 'e7e5'), ev({ kind: 'gameover', outcome: 'loss' }, null))
    expect(r).toMatchObject({ winBefore: 100, winAfter: 100, class: 'best' })
  })

  const qb8 = plies(SAMPLE_PGN).find((p) => p.san === 'Qb8+')!

  it('16.Qb8+!!: thí Hậu dẫn tới chiếu hết, nước thứ 2 không thắng tuyệt đối → Brilliant', () => {
    const r = classifyMove(qb8, ev(mate(2), 'b3b8', cp(300)), ev(mate(1)))
    expect(r.class).toBe('brilliant')
  })

  it('thí quân khi nước khác cũng thắng tuyệt đối → không Brilliant', () => {
    expect(classifyMove(qb8, ev(mate(2), 'b3b8', mate(3)), ev(mate(1))).class).toBe('best')
  })

  it('nước thí quân là biến 2: so với biến 1 (không phải với chính nó)', () => {
    const lines = (first: Score, second: Score): PositionEval => ({
      score: first,
      bestMove: 'd1d8',
      lines: [
        { score: first, pv: ['d1d8'] },
        { score: second, pv: ['b3b8'] },
      ],
      depth: 20,
    })
    // biến 1 (Rd8) cũng thắng tuyệt đối → thí Hậu không phải cách duy nhất
    expect(classifyMove(qb8, lines(mate(3), mate(2)), ev(mate(1))).class).not.toBe('brilliant')
    // biến 1 chỉ hơn chút → thí Hậu mới là cách thắng tuyệt đối
    expect(classifyMove(qb8, lines(cp(300), mate(2)), ev(mate(1))).class).toBe('brilliant')
  })

  it('thí quân làm thua thế → không Brilliant', () => {
    expect(classifyMove(qb8, ev(cp(0), 'd1d8'), ev(cp(-400))).class).toBe('blunder')
  })
})
