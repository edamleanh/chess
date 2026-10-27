import { describe, expect, it } from 'vitest'
import {
  currentFen,
  currentLastMove,
  currentPosition,
  exitVariation,
  goToMain,
  goToVariation,
  INITIAL_STATE,
  last,
  makePly,
  next,
  playMove,
  prev,
  type ReviewState,
} from './exploration'
import { parsePgn } from './parsePgn'

const parsed = parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 *')
if (!parsed.ok) throw new Error(parsed.error)
const game = parsed.game

const at = (ply: number): ReviewState => ({ ply, variation: null })

describe('playMove', () => {
  it('đi đúng nước của ván: chỉ tiến tới, không mở biến phụ', () => {
    expect(playMove(game, at(2), 'g1f3')).toEqual(at(3))
  })

  it('đi nước khác: mở biến phụ rẽ từ vị trí hiện tại', () => {
    const s = playMove(game, at(2), 'b1c3')!
    expect(s.ply).toBe(2)
    expect(s.variation).toMatchObject({ fromPly: 2, cursor: 1 })
    expect(s.variation!.moves[0]).toMatchObject({ san: 'Nc3', uci: 'b1c3', color: 'w', moveNumber: 2, index: 2 })
    expect(currentFen(game, s)).toBe(s.variation!.moves[0].fenAfter)
    expect(currentLastMove(game, s)?.san).toBe('Nc3')
  })

  it('đi tiếp trong biến phụ, rồi rẽ nhánh giữa chừng thì cắt phần sau', () => {
    let s = playMove(game, at(2), 'b1c3')!
    s = playMove(game, s, 'g8f6')!
    s = playMove(game, s, 'f1c4')!
    expect(s.variation!.moves.map((m) => m.san)).toEqual(['Nc3', 'Nf6', 'Bc4'])
    s = prev(game, s) // về sau 2...Nf6
    s = playMove(game, s, 'f2f4')!
    expect(s.variation!.moves.map((m) => m.san)).toEqual(['Nc3', 'Nf6', 'f4'])
    expect(s.variation!.cursor).toBe(3)
    expect(s.variation!.moves[2].index).toBe(4)
  })

  it('đi lại đúng nước tiếp theo của biến phụ: chỉ tiến tới', () => {
    let s = playMove(game, at(2), 'b1c3')!
    s = playMove(game, s, 'g8f6')!
    s = prev(game, prev(game, s)) // về điểm rẽ nhánh (cursor 0)
    expect(s.variation!.cursor).toBe(0)
    s = playMove(game, s, 'b1c3')!
    expect(s.variation!.moves).toHaveLength(2)
    expect(s.variation!.cursor).toBe(1)
  })

  it('nước không hợp lệ: null', () => {
    expect(playMove(game, at(0), 'e2e5')).toBeNull()
    expect(playMove(game, at(1), 'e2e4')).toBeNull() // không phải lượt Trắng
  })

  it('phong cấp', () => {
    expect(makePly('8/P7/8/8/8/8/8/k6K w - - 0 1', 'a7a8q', 0)).toMatchObject({ san: 'a8=Q+', uci: 'a7a8q' })
  })
})

describe('điều hướng', () => {
  const branched = () => playMove(game, playMove(game, at(2), 'b1c3')!, 'g8f6')!

  it('trong biến phụ: next/prev đi theo biến; lùi qua điểm rẽ nhánh thì rời biến phụ', () => {
    let s = branched()
    s = prev(game, s)
    expect(s.variation!.cursor).toBe(1)
    s = next(game, s)
    expect(s.variation!.cursor).toBe(2)
    expect(next(game, s)).toBe(s) // hết biến phụ: đứng yên
    s = prev(game, prev(game, prev(game, s)))
    expect(s).toEqual(at(1))
  })

  it('last: cuối biến phụ, hoặc cuối ván; goToMain và exitVariation rời biến phụ', () => {
    const s = goToVariation(branched(), 0)
    expect(last(game, s).variation!.cursor).toBe(2)
    expect(last(game, at(0))).toEqual(at(5))
    expect(goToMain(game, 4)).toEqual(at(4))
    expect(exitVariation(s)).toEqual(at(2))
  })

  it('ván chính: next/prev kẹp trong [0, số nước]', () => {
    expect(prev(game, INITIAL_STATE)).toEqual(at(0))
    expect(next(game, at(5))).toEqual(at(5))
  })
})

describe('currentPosition', () => {
  it('lịch sử nước = nước ván chính tới điểm rẽ + nước biến phụ tới con trỏ', () => {
    const s = playMove(game, playMove(game, at(2), 'b1c3')!, 'g8f6')!
    expect(currentPosition(game, s)).toMatchObject({
      startFen: game.startFen,
      moves: ['e2e4', 'e7e5', 'b1c3', 'g8f6'],
      fen: s.variation!.moves[1].fenAfter,
    })
    expect(currentPosition(game, at(3)).moves).toEqual(['e2e4', 'e7e5', 'g1f3'])
  })
})
