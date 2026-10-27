import { Chess } from 'chess.js'
import type { GameModel, Ply } from '../types'

export type ParseResult = { ok: true; game: GameModel } | { ok: false; error: string }

/** Rút gọn lỗi của chess.js: lỗi cú pháp từ parser PEG liệt kê rất dài các token mong đợi. */
function describeLoadError(e: unknown): string {
  const detail = e instanceof Error ? e.message : String(e)
  const syntax = detail.match(/but (.+) found\.?$/)
  if (syntax) return `PGN sai cú pháp: gặp ${syntax[1]} ở vị trí không hợp lệ.`
  return `PGN không hợp lệ: ${detail}`
}

/** `[%clk 0:09:58.5]` → 598.5 (giây); không có thì null. */
export function parseClock(comment: string): number | null {
  const m = comment.match(/\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/)
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null
}

export function parsePgn(pgn: string): ParseResult {
  if (pgn.trim() === '') {
    return { ok: false, error: 'Chưa có PGN. Hãy dán nội dung ván cờ vào ô bên trên.' }
  }

  const chess = new Chess()
  try {
    chess.loadPgn(pgn)
  } catch (e) {
    return { ok: false, error: describeLoadError(e) }
  }

  const history = chess.history({ verbose: true })
  if (history.length === 0) {
    return { ok: false, error: 'PGN không chứa nước đi nào.' }
  }

  const startFen = history[0].before
  const startMoveNumber = Number(startFen.split(' ')[5]) || 1
  const startsWithBlack = history[0].color === 'b'

  // Đồng hồ: comment gắn với FEN sau nước đi (FEN đầy đủ, có đếm nước, nên không trùng khi lặp thế cờ)
  const clocks = new Map(
    chess
      .getComments()
      .map(({ fen, comment }) => [fen, parseClock(comment)] as const)
      .filter((entry): entry is readonly [string, number] => entry[1] !== null),
  )

  const plies: Ply[] = history.map((move, index) => ({
    index,
    san: move.san,
    uci: move.lan,
    from: move.from,
    to: move.to,
    color: move.color,
    moveNumber: startMoveNumber + Math.floor((index + (startsWithBlack ? 1 : 0)) / 2),
    fenBefore: move.before,
    fenAfter: move.after,
    ...(clocks.has(move.after) ? { clock: clocks.get(move.after) } : {}),
  }))

  return { ok: true, game: { headers: chess.getHeaders(), startFen, plies } }
}
