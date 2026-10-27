import { describe, expect, it } from 'vitest'
import { fromRow, type PuzzleRow } from './puzzle'
import {
  addPremove,
  clearPremoves,
  displayFen,
  isOpponentTurn,
  isPlayerTurn,
  opponentMove,
  playerMove,
  puzzleOpponentMove,
  solutionFens,
  startSession,
  tick,
  giveUp,
  pauseSession,
  resumeSession,
  type Session,
} from './session'
import { remaining } from './timer'

// ...cxd6 Qf8+ Qxf8 Rxf8#
const MATE_IN_2 = fromRow(['0HSDD', 'r1b1q2k/ppp3pp/3R4/8/8/4PQ2/P5PP/5RK1 b - - 0 19', 'c7d6 f3f8 e8f8 f1f8', 399, 2] as PuzzleRow)

function puzzleAtPlayerTurn(now = 0): Session {
  const s = startSession({ kind: 'puzzle', puzzle: MATE_IN_2 }, 30_000, 0)
  return opponentMove(s, puzzleOpponentMove(s)!, now)
}

describe('session: puzzle', () => {
  it('bắt đầu ở lượt đối phương, người giải là bên còn lại', () => {
    const s = startSession({ kind: 'puzzle', puzzle: MATE_IN_2 }, 30_000, 0)
    expect(s.player).toBe('w')
    expect(isOpponentTurn(s)).toBe(true)
    expect(puzzleOpponentMove(s)).toBe('c7d6')
  })

  it('đồng hồ chỉ chạy trong lượt người giải', () => {
    let s = puzzleAtPlayerTurn(1_000)
    expect(isPlayerTurn(s)).toBe(true)
    s = playerMove(s, 'f3f8', 6_000)!
    expect(remaining(s.clock, 60_000)).toBe(25_000) // đối phương nghĩ bao lâu cũng không trừ
    s = opponentMove(s, puzzleOpponentMove(s)!, 60_000)
    s = playerMove(s, 'f1f8', 62_000)!
    expect(s.status).toBe('solved')
    expect(remaining(s.clock, 99_000)).toBe(23_000)
  })

  it('premove đi ngay khi tới lượt, không tốn giờ', () => {
    let s = puzzleAtPlayerTurn(0)
    s = playerMove(s, 'f3f8', 2_000)!
    s = addPremove(s, { from: 'f1', to: 'f8' })!
    expect(s.premoves).toHaveLength(1)
    expect(displayFen(s).split('/')[0]).toBe('r1b1qR1k') // bàn ảo: Xe đã đứng ở f8
    s = opponentMove(s, 'e8f8', 50_000)
    expect(s.status).toBe('solved')
    expect(remaining(s.clock, 99_000)).toBe(28_000)
  })

  it('sai đáp án thì thua bài', () => {
    const s = playerMove(puzzleAtPlayerTurn(), 'f3f4', 1_000)!
    expect(s.status).toBe('failed')
  })

  it('nước không hợp lệ bị từ chối', () => {
    expect(playerMove(puzzleAtPlayerTurn(), 'f3a8', 0)).toBeNull()
  })

  it('không đi được khi chưa tới lượt; premove chỉ khi chưa tới lượt', () => {
    const start = startSession({ kind: 'puzzle', puzzle: MATE_IN_2 }, 30_000, 0)
    expect(playerMove(start, 'f3f8', 0)).toBeNull()
    expect(addPremove(puzzleAtPlayerTurn(), { from: 'f3', to: 'f8' })).toBeNull()
  })

  it('premove không hợp lệ thì hủy cả hàng đợi', () => {
    let s = startSession({ kind: 'puzzle', puzzle: MATE_IN_2 }, 30_000, 0)
    s = addPremove(s, { from: 'a2', to: 'a3' })!
    s = addPremove(s, { from: 'f3', to: 'f8' })!
    expect(s.premoves).toHaveLength(2)
    s = opponentMove(s, 'c7d6', 0)
    // a2a3 hợp lệ nhưng sai đáp án → thua bài, hàng đợi bị xóa
    expect(s.status).toBe('failed')
    expect(s.premoves).toEqual([])
  })

  it('premove bị chặn trong thế cờ thật thì hủy hàng đợi, vẫn tới lượt người giải', () => {
    let s = startSession({ kind: 'puzzle', puzzle: MATE_IN_2 }, 30_000, 0)
    s = addPremove(s, { from: 'd6', to: 'd8' })! // Xe d6 sẽ bị ăn
    s = opponentMove(s, 'c7d6', 0)
    expect(s.status).toBe('playing')
    expect(s.premoves).toEqual([])
    expect(isPlayerTurn(s)).toBe(true)
  })

  it('clearPremoves', () => {
    let s = startSession({ kind: 'puzzle', puzzle: MATE_IN_2 }, 30_000, 0)
    s = addPremove(s, { from: 'a2', to: 'a3' })!
    expect(clearPremoves(s).premoves).toEqual([])
  })

  it('hết giờ', () => {
    const s = puzzleAtPlayerTurn(0)
    expect(tick(s, 29_999).status).toBe('playing')
    expect(tick(s, 30_000).status).toBe('timeout')
  })

  it('nước đi sau khi hết giờ bị từ chối', () => {
    expect(playerMove(puzzleAtPlayerTurn(0), 'f3f8', 30_050)).toBeNull()
  })

  it('pauseSession / resumeSession', () => {
    let s = pauseSession(puzzleAtPlayerTurn(0), 5_000)
    expect(remaining(s.clock, 100_000)).toBe(25_000)
    s = resumeSession(s, 100_000)
    expect(remaining(s.clock, 101_000)).toBe(24_000)
  })

  it('giveUp: đang làm thì thành thua bài, đã xong thì giữ nguyên', () => {
    const s = giveUp(puzzleAtPlayerTurn(0), 1_000)
    expect(s.status).toBe('failed')
    expect(s.reason).toBe('Đã xem đáp án')
    expect(remaining(s.clock, 50_000)).toBe(29_000)
    expect(giveUp(s, 2_000)).toBe(s)
    expect(giveUp(puzzleAtPlayerTurn(0), 0, 'Đã mở phân tích').reason).toBe('Đã mở phân tích')
  })

  it('solutionFens đi hết đáp án', () => {
    const line = solutionFens(MATE_IN_2)
    expect(line).toHaveLength(4)
    expect(line[3].lastMove.san).toBe('Rxf8#')
  })
})

describe('session: chiếu hết cơ bản', () => {
  const task = { kind: 'endgame' as const, endgame: 'KQ' as const, fen: '7k/8/6K1/8/8/8/8/Q7 w - - 0 1' }

  it('bài bắt đầu ở lượt người chơi thì đồng hồ chạy ngay', () => {
    const s = startSession(task, 60_000, 1_000)
    expect(remaining(s.clock, 11_000)).toBe(50_000)
  })

  it('Trắng đi trước, chiếu hết là xong bài', () => {
    const s = startSession(task, 60_000, 0)
    expect(s.player).toBe('w')
    expect(isPlayerTurn(s)).toBe(true)
    expect(playerMove(s, 'a1a8', 0)!.status).toBe('solved')
  })

  it('hòa pat là thua bài', () => {
    const s = playerMove(startSession(task, 60_000, 0), 'a1a2', 0)!
    expect(s.status).toBe('failed')
    expect(s.reason).toBe('Hòa pat')
  })

  it('Đen ăn mất Hậu là thua bài', () => {
    let s = startSession({ ...task, fen: '7K/8/8/8/8/8/1k6/2Q5 w - - 0 1' }, 60_000, 0)
    s = playerMove(s, 'c1c2', 0)!
    s = opponentMove(s, 'b2c2', 100)
    expect(s.status).toBe('failed')
    expect(s.reason).toMatch(/không đủ quân/)
  })
})
