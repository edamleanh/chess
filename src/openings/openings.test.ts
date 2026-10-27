import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { parsePgn } from '../chess/parsePgn'
import { SAMPLE_PGN } from '../chess/samplePgn'
import dbJson from './openings.json'
import { detectOpening, epd, type OpeningDb } from './openings'

const db: OpeningDb = dbJson

function game(pgn: string) {
  const parsed = parsePgn(pgn)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.game
}

describe('epd', () => {
  it('bỏ 2 trường đếm nước', () => {
    expect(epd('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -',
    )
  })
})

describe('openings.json', () => {
  it('ô bắt tốt qua đường chỉ có khi bắt được thật (cách chess.js 1.4 ghi FEN, khớp với parsePgn)', () => {
    // Nếu chess.js đổi cách ghi ô e.p., các khóa này sẽ không khớp FEN của ván nữa: build lại openings.json
    const withEp = Object.keys(db).filter((k) => !k.endsWith(' -'))
    expect(withEp.length).toBeGreaterThan(0)
    for (const key of withEp) {
      const target = key.split(' ')[3]
      const moves = new Chess(`${key} 0 1`).moves({ verbose: true })
      expect(moves.some((m) => m.isEnPassant() && m.to === target), key).toBe(true)
    }
  })
})

describe('detectOpening (dữ liệu thật)', () => {
  it('ván Morphy: Philidor Defense (C41); tên theo từng nước, 1.e4 chưa phải Philidor', () => {
    const info = detectOpening(game(SAMPLE_PGN), db)
    expect(info.opening).toEqual({ eco: 'C41', name: 'Philidor Defense' })
    expect(info.bookPlies).toBe(7) // tới 4.dxe5 (3...Bg4, 4.dxe5 là thế cờ trung gian); 4...Bxf3 ra khỏi lý thuyết
    expect(info.byPly[0]).toEqual({ eco: 'B00', name: "King's Pawn Game" })
    expect(info.byPly[2]).toEqual({ eco: 'C40', name: "King's Knight Opening" })
    expect(info.byPly[6]).toEqual({ eco: 'C41', name: 'Philidor Defense' })
  })

  it('biến chính dài vẫn là Book tới hết lý thuyết (Najdorf 6.Bg5)', () => {
    const info = detectOpening(game('1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5 *'), db)
    expect(info.bookPlies).toBe(11)
    expect(info.opening?.eco).toBe('B94')
    expect(info.opening?.name).toMatch(/^Sicilian Defense: Najdorf Variation/)
  })

  it('dừng ở nước lệch lý thuyết, không tính tiếp dù sau đó chuyển thế', () => {
    const info = detectOpening(game('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0'), db)
    expect(info.opening).toEqual({ eco: 'C20', name: "King's Pawn Game: Wayward Queen Attack" })
    expect(info.bookPlies).toBeGreaterThanOrEqual(3)
    expect(info.bookPlies).toBeLessThan(6) // 3...Nf6?? không phải lý thuyết
  })

  it('chuyển thế trong lúc còn Book vẫn nhận ra (Two Knights qua 2.Bc4)', () => {
    const info = detectOpening(game('1. e4 e5 2. Bc4 Nf6 3. Nf3 Nc6 *'), db)
    expect(info.bookPlies).toBe(6)
    expect(info.opening?.name).toMatch(/Two Knights/)
  })

  it('ván bắt đầu từ FEN tùy chỉnh: không có Book', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    expect(detectOpening(game(`[SetUp "1"]\n[FEN "${fen}"]\n\n1... e5 *`), db)).toEqual({
      bookPlies: 0,
      opening: null,
      byPly: [],
    })
  })
})

describe('detectOpening (db giả)', () => {
  it('thế cờ trung gian (0) là Book nhưng không đổi tên khai cuộc', () => {
    const g = game('1. e4 e5 *')
    const fakeDb: OpeningDb = { [epd(g.plies[0].fenAfter)]: ['B00', 'King'], [epd(g.plies[1].fenAfter)]: 0 }
    expect(detectOpening(g, fakeDb)).toEqual({
      bookPlies: 2,
      opening: { eco: 'B00', name: 'King' },
      byPly: [
        { eco: 'B00', name: 'King' },
        { eco: 'B00', name: 'King' },
      ],
    })
  })
})
