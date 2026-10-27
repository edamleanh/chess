import { describe, expect, it } from 'vitest'
import { parsePgn } from './parsePgn'
import { SAMPLE_PGN } from './samplePgn'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function parseOk(pgn: string) {
  const result = parsePgn(pgn)
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  return result.game
}

describe('parsePgn', () => {
  it('parse ván Scholar’s mate thành 7 ply có FEN trước/sau', () => {
    const game = parseOk('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0')

    expect(game.startFen).toBe(START_FEN)
    expect(game.plies).toHaveLength(7)
    expect(game.plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'])

    const first = game.plies[0]
    expect(first).toMatchObject({ index: 0, uci: 'e2e4', from: 'e2', to: 'e4', color: 'w', moveNumber: 1 })
    expect(first.fenBefore).toBe(START_FEN)
    expect(game.plies[1]).toMatchObject({ color: 'b', moveNumber: 1, fenBefore: first.fenAfter })
    expect(game.plies[6].moveNumber).toBe(4)
  })

  it('đọc header và bỏ qua comment', () => {
    const game = parseOk(SAMPLE_PGN.replace('1. e4', '1. e4 {nước mở đầu phổ biến}'))

    expect(game.headers.White).toBe('Paul Morphy')
    expect(game.headers.Result).toBe('1-0')
    expect(game.plies).toHaveLength(33)
    expect(game.plies.at(-1)?.san).toBe('Rd8#')
  })

  it('chỉ lấy đường chính, bỏ biến phụ', () => {
    const game = parseOk('1. e4 (1. d4 d5) 1... e5 2. Nf3 *')
    expect(game.plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Nf3'])
  })

  it('UCI có ký tự phong cấp', () => {
    const fen = '8/P7/8/8/8/8/8/k6K w - - 0 1'
    const game = parseOk(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. a8=Q+ *`)
    expect(game.plies[0].uci).toBe('a7a8q')
  })

  it('dùng header FEN làm thế cờ ban đầu, đúng số nước khi Đen đi trước', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const game = parseOk(`[SetUp "1"]\n[FEN "${fen}"]\n\n1... e5 2. Nf3 *`)

    expect(game.startFen).toBe(fen)
    expect(game.plies.map((p) => [p.color, p.moveNumber])).toEqual([
      ['b', 1],
      ['w', 2],
    ])
  })

  it('báo lỗi khi PGN rỗng', () => {
    expect(parsePgn('   ')).toMatchObject({ ok: false })
  })

  it('báo lỗi khi có nước không hợp lệ', () => {
    const result = parsePgn('1. e4 e5 2. Ke3 Ke6 3. Qh8 *')
    expect(result.ok).toBe(false)
  })

  it('rút gọn lỗi cú pháp', () => {
    const result = parsePgn('1. e4 e5 2. Ke3 Qh9')
    expect(result).toEqual({ ok: false, error: 'PGN sai cú pháp: gặp "9" ở vị trí không hợp lệ.' })
  })

  it('báo lỗi khi PGN không có nước đi', () => {
    expect(parsePgn('[White "A"]\n[Black "B"]\n\n*')).toMatchObject({ ok: false })
  })
})
