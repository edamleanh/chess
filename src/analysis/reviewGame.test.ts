import { describe, expect, it } from 'vitest'
import { parsePgn } from '../chess/parsePgn'
import type { PositionEval, Score } from '../types'
import { reviewGame } from './reviewGame'

const parsed = parsePgn('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0')
if (!parsed.ok) throw new Error(parsed.error)
const game = parsed.game

const ev = (score: Score, bestMove: string | null): PositionEval => ({
  score,
  bestMove,
  lines: [{ score, pv: [] }],
  depth: 20,
})

// Eval giả lập (góc nhìn Trắng) cho 8 vị trí của Scholar's mate; evals[i] là vị trí trước nước thứ i+1
const evals: PositionEval[] = [
  ev({ kind: 'cp', value: 30 }, 'e2e4'), // thế cờ đầu
  ev({ kind: 'cp', value: 30 }, 'e7e5'), // sau 1.e4
  ev({ kind: 'cp', value: 30 }, 'g1f3'), // sau 1...e5 (Bc4 không phải nước tốt nhất)
  ev({ kind: 'cp', value: 20 }, 'b8c6'), // sau 2.Bc4
  ev({ kind: 'cp', value: 20 }, 'g1f3'), // sau 2...Nc6 (Qh5 không phải nước tốt nhất)
  ev({ kind: 'cp', value: 0 }, 'g7g6'), // sau 3.Qh5
  ev({ kind: 'mate', value: 1 }, 'h5f7'), // sau 3...Nf6??
  ev({ kind: 'gameover', outcome: 'win' }, null), // sau 4.Qxf7#
]

describe('reviewGame', () => {
  it('chấm từng nước, đếm theo bên, tính Accuracy khi đủ eval', () => {
    const review = reviewGame(game, evals)
    expect(review.moves.map((m) => m?.class)).toEqual([
      'best', // e4
      'best', // e5
      'excellent', // Bc4
      'best', // Nc6
      'excellent', // Qh5: 20 → 0 cp, tụt khoảng 1.8 win%
      'blunder', // Nf6??
      'best', // Qxf7#
    ])
    expect(review.counts.b.blunder).toBe(1)
    expect(review.counts.w.blunder).toBe(0)
    expect(review.accuracy!.w!).toBeGreaterThan(review.accuracy!.b!)
  })

  it('bookPlies nước đầu nhận nhãn Book, accuracy giữ nguyên', () => {
    const plain = reviewGame(game, evals)
    const review = reviewGame(game, evals, 3)
    expect(review.moves.map((m) => m?.class).slice(0, 4)).toEqual(['book', 'book', 'book', 'best'])
    expect(review.counts.w.book).toBe(2)
    expect(review.counts.b.book).toBe(1)
    expect(review.accuracy).toEqual(plain.accuracy)
    expect(review.moves[0]?.accuracy).toBe(plain.moves[0]?.accuracy)
  })

  it('nước khai cuộc luôn là Book như chess.com, kể cả khi engine chấm Blunder (gambit nghi vấn)', () => {
    // Giả lập: Nf6 (ply 5) nằm trong "lý thuyết" nhưng engine chấm Blunder
    const review = reviewGame(game, evals, 6)
    expect(review.moves.slice(0, 6).every((m) => m?.class === 'book')).toBe(true)
    expect(review.moves[6]?.class).toBe('best') // ngoài Book: nhãn của engine
  })

  it('bookPlies với eval một phần: chỉ nước đã có eval mới có nhãn', () => {
    const review = reviewGame(game, [...evals.slice(0, 3), null, null, null, null, null], 4)
    expect(review.moves.map((m) => m?.class ?? null)).toEqual(['book', 'book', null, null, null, null, null])
  })

  it('kết quả một phần: nước chưa đủ eval là null, chưa có Accuracy', () => {
    const review = reviewGame(game, [...evals.slice(0, 3), null, null, null, null, null])
    expect(review.moves.slice(0, 2).every((m) => m !== null)).toBe(true)
    expect(review.moves.slice(2).every((m) => m === null)).toBe(true)
    expect(review.accuracy).toBeNull()
  })
})
