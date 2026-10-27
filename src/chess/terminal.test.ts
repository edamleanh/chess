import { describe, expect, it } from 'vitest'
import { terminalScore } from './terminal'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('terminalScore', () => {
  it('Trắng bị chiếu hết (Fool’s mate) → Đen thắng', () => {
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
    expect(terminalScore({ fen })).toEqual({ kind: 'gameover', outcome: 'loss' })
  })

  it('Đen bị chiếu hết → Trắng thắng', () => {
    const fen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4'
    expect(terminalScore({ fen })).toEqual({ kind: 'gameover', outcome: 'win' })
  })

  it('hòa pat và không đủ quân', () => {
    expect(terminalScore({ fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1' })).toEqual({ kind: 'gameover', outcome: 'draw' })
    expect(terminalScore({ fen: '8/8/8/4k3/8/8/8/4K3 w - - 0 1' })).toEqual({ kind: 'gameover', outcome: 'draw' })
  })

  it('lặp 3 lần: chỉ nhận ra khi có lịch sử nước', () => {
    const moves = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']
    expect(terminalScore({ fen: START, startFen: START, moves })).toEqual({ kind: 'gameover', outcome: 'draw' })
    expect(terminalScore({ fen: START })).toBeNull()
  })

  it('vị trí chưa kết thúc → null', () => {
    expect(terminalScore({ fen: START })).toBeNull()
  })
})
