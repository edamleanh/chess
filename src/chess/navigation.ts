import type { GameModel, Ply } from '../types'

/**
 * Vị trí trên ván được biểu diễn bằng số ply đã đi, nằm trong [0, plies.length]:
 * 0 là thế cờ ban đầu, k là thế cờ sau nước thứ k.
 */
export function clampPly(ply: number, total: number): number {
  return Math.min(Math.max(ply, 0), total)
}

export function fenAt(game: GameModel, ply: number): string {
  const p = clampPly(ply, game.plies.length)
  return p === 0 ? game.startFen : game.plies[p - 1].fenAfter
}

/** Vị trí `ply` kèm lịch sử nước (UCI) từ thế cờ đầu, để engine nhận ra lặp 3 lần. */
export function positionAt(game: GameModel, ply: number): { fen: string; startFen: string; moves: string[] } {
  const p = clampPly(ply, game.plies.length)
  return { fen: fenAt(game, p), startFen: game.startFen, moves: game.plies.slice(0, p).map((m) => m.uci) }
}

/** Nước vừa đi để tới vị trí `ply`, hoặc null nếu đang ở thế cờ ban đầu. */
export function lastMoveAt(game: GameModel, ply: number): Ply | null {
  const p = clampPly(ply, game.plies.length)
  return p === 0 ? null : game.plies[p - 1]
}
