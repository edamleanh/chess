export type Color = 'w' | 'b'

/** Một nước đi (half-move) trong ván. */
export interface Ply {
  /** Vị trí trong ván, bắt đầu từ 0. */
  index: number
  san: string
  /** Nước dạng UCI, ví dụ "e2e4", "e7e8q". */
  uci: string
  from: string
  to: string
  color: Color
  /** Số nước theo ký hiệu cờ (1. e4 e5 → cả hai đều là 1). */
  moveNumber: number
  fenBefore: string
  fenAfter: string
  /** Thời gian còn lại của người đi sau nước này (giây), từ comment `[%clk h:mm:ss]` của PGN nếu có. */
  clock?: number
}

/**
 * Điểm đánh giá theo góc nhìn của một bên (xem từng chỗ dùng để biết là bên nào).
 * - cp: centipawn
 * - mate: chiếu hết sau |value| nước; dương = bên này chiếu hết, âm = bị chiếu hết
 * - gameover: ván đã kết thúc tại vị trí này
 */
export type Score =
  | { kind: 'cp'; value: number }
  | { kind: 'mate'; value: number }
  | { kind: 'gameover'; outcome: 'win' | 'loss' | 'draw' }

/** Kết quả engine cho một vị trí. Mọi score theo góc nhìn Trắng. */
export interface PositionEval {
  score: Score
  /** Nước tốt nhất (UCI); null nếu ván đã kết thúc tại vị trí này. */
  bestMove: string | null
  /** Các biến chính theo thứ tự multipv (lines[0] là tốt nhất). */
  lines: { score: Score; pv: string[] }[]
  depth: number | null
}

export interface GameModel {
  headers: Record<string, string>
  startFen: string
  plies: Ply[]
}
