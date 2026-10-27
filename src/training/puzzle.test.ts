import { describe, expect, it } from 'vitest'
import { checkMove, fromRow, opponentReply, remainingSolution, startPuzzle, type PuzzleRow } from './puzzle'
import rows from './puzzles.json'

// Mate in 2 thật của lichess: ...cxd6 Qf8+ Qxf8 Rxf8#
const MATE_IN_2: PuzzleRow = ['0HSDD', 'r1b1q2k/ppp3pp/3R4/8/8/4PQ2/P5PP/5RK1 b - - 0 19', 'c7d6 f3f8 e8f8 f1f8', 399, 2]
// Hai Xe trên hàng 1, Ra8# và Rb8# đều chiếu hết
const TWO_MATES: PuzzleRow = ['alt', '6k1/2p2ppp/8/8/8/8/5PPP/RR4K1 b - - 0 1', 'c7c6 a1a8', 600, 1]

describe('puzzle', () => {
  it('startPuzzle đi nước mở đầu của đối phương, người giải là bên tới lượt', () => {
    const state = startPuzzle(fromRow(MATE_IN_2))
    expect(state.solver).toBe('w')
    expect(state.step).toBe(1)
    expect(state.played).toEqual(['c7d6'])
    expect(state.fen.split(' ')[1]).toBe('w')
  })

  it('giải đúng từng bước tới chiếu hết', () => {
    let state = startPuzzle(fromRow(MATE_IN_2))
    const first = checkMove(state, 'f3f8')
    expect(first.kind).toBe('correct')
    if (first.kind !== 'correct') return
    const reply = opponentReply(first.state)
    expect(reply?.uci).toBe('e8f8')
    state = reply!.state
    expect(remainingSolution(state)).toEqual(['f1f8'])
    const last = checkMove(state, 'f1f8')
    expect(last.kind).toBe('solved')
  })

  it('nước hợp lệ nhưng sai đáp án', () => {
    const state = startPuzzle(fromRow(MATE_IN_2))
    expect(checkMove(state, 'f3f4').kind).toBe('wrong')
  })

  it('nước không hợp lệ', () => {
    const state = startPuzzle(fromRow(MATE_IN_2))
    expect(checkMove(state, 'f3a8').kind).toBe('illegal')
  })

  it('chiếu hết khác đáp án vẫn tính đúng', () => {
    const state = startPuzzle(fromRow(TWO_MATES))
    expect(checkMove(state, 'b1b8').kind).toBe('solved')
    expect(checkMove(state, 'a1a8').kind).toBe('solved')
  })

  it('opponentReply trả null khi hết đáp án', () => {
    const state = startPuzzle(fromRow(TWO_MATES))
    const done = checkMove(state, 'a1a8')
    expect(opponentReply(done.kind === 'illegal' ? state : done.state)).toBeNull()
  })

  it('mọi bài trong puzzles.json đều chơi được tới chiếu hết', () => {
    for (const row of rows as PuzzleRow[]) {
      const puzzle = fromRow(row)
      let state = startPuzzle(puzzle)
      for (;;) {
        const result = checkMove(state, puzzle.moves[state.step])
        expect(result.kind, puzzle.id).not.toBe('illegal')
        expect(result.kind, puzzle.id).not.toBe('wrong')
        if (result.kind === 'solved') break
        if (result.kind !== 'correct') break
        const reply = opponentReply(result.state)
        expect(reply, puzzle.id).not.toBeNull()
        state = reply!.state
      }
    }
  }, 120_000) // 15.000 bài: chạy khoảng 15–20 s
})
