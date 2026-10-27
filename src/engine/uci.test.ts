import { describe, expect, it } from 'vitest'
import { negateScore } from '../analysis/perspective'
import { parseBestMove, parseInfo, toWhitePov } from './uci'

const WHITE_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const BLACK_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

describe('parseInfo', () => {
  it('đọc depth, score cp, nodes, nps, pv', () => {
    const info = parseInfo(
      'info depth 20 seldepth 31 multipv 1 score cp 35 nodes 1441533 nps 400648 hashfull 77 tbhits 0 time 3598 pv e2e4 e7e5 g1f3',
    )
    expect(info).toEqual({
      depth: 20,
      seldepth: 31,
      multipv: 1,
      score: { kind: 'cp', value: 35 },
      nodes: 1441533,
      nps: 400648,
      pv: ['e2e4', 'e7e5', 'g1f3'],
    })
  })

  it('đọc score mate dương/âm', () => {
    expect(parseInfo('info depth 5 score mate 3 pv a1a8')?.score).toEqual({ kind: 'mate', value: 3 })
    expect(parseInfo('info depth 5 score mate -2 pv a1a8')?.score).toEqual({ kind: 'mate', value: -2 })
  })

  it('đọc lowerbound/upperbound và multipv', () => {
    const info = parseInfo('info depth 18 multipv 2 score cp -12 upperbound nodes 10 pv d2d4')
    expect(info).toMatchObject({ multipv: 2, score: { kind: 'cp', value: -12 }, bound: 'upper', nodes: 10 })
    expect(parseInfo('info depth 18 score cp 40 lowerbound pv d2d4')?.bound).toBe('lower')
  })

  it('bỏ qua dòng không có score, info string và dòng không phải info', () => {
    expect(parseInfo('info depth 12 currmove e2e4 currmovenumber 1')).toBeNull()
    expect(parseInfo('info string NNUE evaluation using nn-1c0000000000.nnue enabled')).toBeNull()
    expect(parseInfo('bestmove e2e4')).toBeNull()
    expect(parseInfo('info depth 5 score cp pv e2e4')).toBeNull()
    expect(parseInfo('readyok')).toBeNull()
  })
})

describe('parseBestMove', () => {
  it('lấy nước tốt nhất, null khi không có nước, undefined khi không phải dòng bestmove', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4')
    expect(parseBestMove('bestmove e7e8q')).toBe('e7e8q')
    expect(parseBestMove('bestmove (none)')).toBeNull()
    expect(parseBestMove('info depth 1 score cp 0')).toBeUndefined()
  })
})

describe('toWhitePov', () => {
  it('giữ nguyên khi Trắng tới lượt', () => {
    expect(toWhitePov({ kind: 'cp', value: 50 }, WHITE_TO_MOVE)).toEqual({ kind: 'cp', value: 50 })
    expect(toWhitePov({ kind: 'mate', value: 2 }, WHITE_TO_MOVE)).toEqual({ kind: 'mate', value: 2 })
  })

  it('đổi dấu khi Đen tới lượt', () => {
    expect(toWhitePov({ kind: 'cp', value: 50 }, BLACK_TO_MOVE)).toEqual({ kind: 'cp', value: -50 })
    expect(toWhitePov({ kind: 'mate', value: 3 }, BLACK_TO_MOVE)).toEqual({ kind: 'mate', value: -3 })
    expect(toWhitePov({ kind: 'mate', value: -1 }, BLACK_TO_MOVE)).toEqual({ kind: 'mate', value: 1 })
  })

  it('mate 0: bên tới lượt đã bị chiếu hết', () => {
    expect(toWhitePov({ kind: 'mate', value: 0 }, WHITE_TO_MOVE)).toEqual({ kind: 'gameover', outcome: 'loss' })
    expect(toWhitePov({ kind: 'mate', value: 0 }, BLACK_TO_MOVE)).toEqual({ kind: 'gameover', outcome: 'win' })
    expect(toWhitePov({ kind: 'gameover', outcome: 'win' }, BLACK_TO_MOVE)).toEqual({ kind: 'gameover', outcome: 'loss' })
  })
})

describe('negateScore', () => {
  it('đảo cp, mate và kết quả ván', () => {
    expect(negateScore({ kind: 'cp', value: 20 })).toEqual({ kind: 'cp', value: -20 })
    expect(negateScore({ kind: 'mate', value: -3 })).toEqual({ kind: 'mate', value: 3 })
    expect(negateScore({ kind: 'gameover', outcome: 'win' })).toEqual({ kind: 'gameover', outcome: 'loss' })
    expect(negateScore({ kind: 'gameover', outcome: 'draw' })).toEqual({ kind: 'gameover', outcome: 'draw' })
  })
})
