import { Chess } from 'chess.js'
import type { LastMove } from './session'

/**
 * Phân tích tự do sau khi làm xong bài: đi lại các nước đã đi, tự đi quân cho cả hai bên.
 * `cursor` = số nước đang áp dụng (0 = thế cờ đầu bài). Đi một nước ở giữa thì bỏ các nước phía sau.
 */
export interface Explore {
  startFen: string
  moves: string[]
  cursor: number
}

export function startExplore(startFen: string, moves: string[]): Explore {
  return { startFen, moves, cursor: moves.length }
}

function replay(startFen: string, moves: string[]): { chess: Chess; last: LastMove | null } {
  const chess = new Chess(startFen)
  let last: LastMove | null = null
  for (const uci of moves) {
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    last = { from: m.from, to: m.to, san: m.san }
  }
  return { chess, last }
}

/** Thế cờ và nước vừa đi tại vị trí đang xem. */
export function explorePosition(e: Explore): { fen: string; lastMove: LastMove | null } {
  const { chess, last } = replay(e.startFen, e.moves.slice(0, e.cursor))
  return { fen: chess.fen(), lastMove: last }
}

/** Đi một nước (bên nào tới lượt cũng được); null nếu không hợp lệ. */
export function explorePlay(e: Explore, uci: string): Explore | null {
  const { chess } = replay(e.startFen, e.moves.slice(0, e.cursor))
  try {
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    // Trùng nước kế tiếp đã có thì chỉ đi tới, giữ phần sau
    if (e.moves[e.cursor] === m.lan) return { ...e, cursor: e.cursor + 1 }
    return { ...e, moves: [...e.moves.slice(0, e.cursor), m.lan], cursor: e.cursor + 1 }
  } catch {
    return null
  }
}

/** Đi tới / lùi `delta` nước, kẹp trong [0, moves.length]. */
export function exploreStep(e: Explore, delta: number): Explore {
  const cursor = Math.max(0, Math.min(e.moves.length, e.cursor + delta))
  return cursor === e.cursor ? e : { ...e, cursor }
}

/** SAN của các nước (để hiện danh sách nước). */
export function exploreSans(e: Explore): string[] {
  const chess = new Chess(e.startFen)
  return e.moves.map((uci) => chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san)
}
