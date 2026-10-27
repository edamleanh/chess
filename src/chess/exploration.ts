import { Chess } from 'chess.js'
import type { EnginePosition } from '../engine/StockfishEngine'
import type { GameModel, Ply } from '../types'
import { clampPly, fenAt, lastMoveAt } from './navigation'

/**
 * Biến phụ người dùng tự đi khi xem lại ván ("thử nước khác"). Rẽ từ vị trí `fromPly` của ván chính;
 * `cursor` là số nước của biến đang được xem (0 = đang đứng ở điểm rẽ nhánh).
 */
export interface Variation {
  fromPly: number
  moves: Ply[]
  cursor: number
}

/**
 * Vị trí đang xem. Khi có biến phụ thì luôn `ply === variation.fromPly`
 * (ván chính "dừng" ở điểm rẽ nhánh).
 */
export interface ReviewState {
  ply: number
  variation: Variation | null
}

export const INITIAL_STATE: ReviewState = { ply: 0, variation: null }

const inVariation = (s: ReviewState): s is ReviewState & { variation: Variation } =>
  s.variation !== null && s.variation.cursor > 0

export function currentFen(game: GameModel, s: ReviewState): string {
  return inVariation(s) ? s.variation.moves[s.variation.cursor - 1].fenAfter : fenAt(game, s.ply)
}

/** Nước vừa đi để tới vị trí đang xem (trong biến phụ nếu đang ở biến phụ). */
export function currentLastMove(game: GameModel, s: ReviewState): Ply | null {
  return inVariation(s) ? s.variation.moves[s.variation.cursor - 1] : lastMoveAt(game, s.ply)
}

/** Vị trí đang xem kèm lịch sử nước từ đầu ván, cho engine (nhận ra lặp 3 lần). */
export function currentPosition(game: GameModel, s: ReviewState): EnginePosition {
  const main = game.plies.slice(0, s.ply).map((p) => p.uci)
  const extra = s.variation ? s.variation.moves.slice(0, s.variation.cursor).map((p) => p.uci) : []
  return { fen: currentFen(game, s), startFen: game.startFen, moves: [...main, ...extra] }
}

/** Đổi chuỗi UCI ("e7e8q") thành Ply nếu hợp lệ tại `fen`; `index` là số nửa nước tính từ đầu ván. */
export function makePly(fen: string, uci: string, index: number): Ply | null {
  const chess = new Chess(fen)
  let move
  try {
    move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return null
  }
  return {
    index,
    san: move.san,
    uci: move.lan,
    from: move.from,
    to: move.to,
    color: move.color,
    moveNumber: Number(fen.split(' ')[5]) || 1,
    fenBefore: move.before,
    fenAfter: move.after,
  }
}

/**
 * Đi một nước tại vị trí đang xem. Trùng nước của ván (hoặc của biến phụ) thì chỉ tiến tới;
 * khác thì mở biến phụ mới, hoặc cắt phần sau con trỏ của biến phụ rồi rẽ nhánh. Trả null nếu nước không hợp lệ.
 */
export function playMove(game: GameModel, s: ReviewState, uci: string): ReviewState | null {
  const v = s.variation
  const index = s.ply + (v?.cursor ?? 0)
  const ply = makePly(currentFen(game, s), uci, index)
  if (!ply) return null

  if (!v || v.cursor === 0) {
    if (game.plies[s.ply]?.uci === ply.uci) return { ply: s.ply + 1, variation: null }
    if (v && v.moves[0]?.uci === ply.uci) return { ply: s.ply, variation: { ...v, cursor: 1 } }
    return { ply: s.ply, variation: { fromPly: s.ply, moves: [ply], cursor: 1 } }
  }
  if (v.moves[v.cursor]?.uci === ply.uci) return { ...s, variation: { ...v, cursor: v.cursor + 1 } }
  return { ...s, variation: { ...v, moves: [...v.moves.slice(0, v.cursor), ply], cursor: v.cursor + 1 } }
}

export function next(game: GameModel, s: ReviewState): ReviewState {
  const v = s.variation
  if (v) return v.cursor < v.moves.length ? { ...s, variation: { ...v, cursor: v.cursor + 1 } } : s
  return { ply: clampPly(s.ply + 1, game.plies.length), variation: null }
}

/** Lùi một nước. Lùi qua điểm rẽ nhánh thì rời biến phụ (biến phụ bị bỏ). */
export function prev(game: GameModel, s: ReviewState): ReviewState {
  const v = s.variation
  if (v && v.cursor > 0) return { ...s, variation: { ...v, cursor: v.cursor - 1 } }
  return { ply: clampPly(s.ply - 1, game.plies.length), variation: null }
}

export function first(): ReviewState {
  return INITIAL_STATE
}

export function last(game: GameModel, s: ReviewState): ReviewState {
  const v = s.variation
  if (v) return { ...s, variation: { ...v, cursor: v.moves.length } }
  return { ply: game.plies.length, variation: null }
}

/** Nhảy tới vị trí `ply` của ván chính (rời biến phụ). */
export function goToMain(game: GameModel, ply: number): ReviewState {
  return { ply: clampPly(ply, game.plies.length), variation: null }
}

export function goToVariation(s: ReviewState, cursor: number): ReviewState {
  const v = s.variation
  if (!v) return s
  return { ...s, variation: { ...v, cursor: Math.min(Math.max(cursor, 0), v.moves.length) } }
}

/** Rời biến phụ, quay về điểm rẽ nhánh trên ván chính. */
export function exitVariation(s: ReviewState): ReviewState {
  return { ply: s.ply, variation: null }
}
