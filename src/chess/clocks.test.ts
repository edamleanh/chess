import { describe, expect, it } from 'vitest'
import { averageTime, clocksAt, formatClock, parseTimeControl, timeSpent } from './clocks'
import { materialFromFen } from './material'
import { parseClock, parsePgn } from './parsePgn'

const PGN = `[White "A"]
[Black "B"]
[TimeControl "180+2"]

1. e4 {[%clk 0:03:01]} 1... e5 {[%clk 0:02:55.5]} 2. Nf3 {[%clk 0:02:50]} 2... Nc6 {[%clk 0:02:57.5]} *`

function game(pgn = PGN) {
  const parsed = parsePgn(pgn)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.game
}

describe('đồng hồ', () => {
  it('parseClock / parseTimeControl', () => {
    expect(parseClock('[%clk 0:09:58.5]')).toBe(598.5)
    expect(parseClock('[%clk 1:02:05]')).toBe(3725)
    expect(parseClock('không có')).toBeNull()
    expect(parseTimeControl('180+2')).toEqual({ base: 180, increment: 2 })
    expect(parseTimeControl('600')).toEqual({ base: 600, increment: 0 })
    expect(parseTimeControl('1/259200')).toBeNull()
    expect(parseTimeControl(undefined)).toBeNull()
  })

  it('parsePgn đọc đồng hồ của từng nước', () => {
    expect(game().plies.map((p) => p.clock)).toEqual([181, 175.5, 170, 177.5])
  })

  it('thời gian dùng cho mỗi nước có tính increment', () => {
    // e4: 180 − 181 + 2 = 1; e5: 180 − 175.5 + 2 = 6.5; Nf3: 181 − 170 + 2 = 13; Nc6: 175.5 − 177.5 + 2 = 0
    expect(timeSpent(game())).toEqual([1, 6.5, 13, 0])
    expect(averageTime(game(), timeSpent(game()), 'w')).toBe(7)
  })

  it('không có đồng hồ → null', () => {
    expect(timeSpent(game('1. e4 e5 *'))).toEqual([null, null])
  })

  it('clocksAt: đồng hồ mỗi bên tại vị trí đang xem', () => {
    expect(clocksAt(game(), 0)).toEqual({ w: 180, b: 180 })
    expect(clocksAt(game(), 3)).toEqual({ w: 170, b: 175.5 })
  })

  it('formatClock', () => {
    expect(formatClock(598.5)).toBe('9:58')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(7.3)).toBe('0:07.3')
  })
})

describe('materialFromFen', () => {
  it('thế cờ đầu: không ai ăn quân', () => {
    expect(materialFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toEqual({
      captured: { w: [], b: [] },
      advantage: { w: 0, b: 0 },
    })
  })

  it('Trắng ăn được Hậu và Tốt của Đen, mất một Mã', () => {
    const info = materialFromFen('rnb1kbnr/ppp1pppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1')
    expect(info.captured.w).toEqual(['p', 'q'])
    expect(info.captured.b).toEqual(['n'])
    expect(info.advantage).toEqual({ w: 7, b: -7 })
  })

  it('quân phong cấp không làm đếm âm', () => {
    const info = materialFromFen('QQ6/8/8/8/8/8/8/k6K w - - 0 1')
    expect(info.captured.b).toEqual(['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'n', 'n', 'b', 'b', 'r', 'r'])
  })
})
