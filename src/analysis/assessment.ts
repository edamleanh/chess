import type { Color, PositionEval, Score } from '../types'
import { scoreForMover } from './perspective'
import { winPercent } from './winPercent'

export interface Assessment {
  text: string
  /** Bên đang hơn; null khi cân bằng hoặc hòa. */
  side: Color | null
  /** Có đòn chiếu hết: số nước (của bên chiếu hết). */
  mateIn: number | null
}

const NAME: Record<Color, string> = { w: 'Trắng', b: 'Đen' }

/** Mức chênh cơ hội thắng (điểm win%) cho từng câu mô tả. */
const SLIGHT = 5
const CLEAR = 15
const CRUSHING = 30

/** Câu đánh giá thế cờ (score theo góc nhìn Trắng), vd. "Trắng chiếu hết sau 3 nước", "Đen ưu thế". */
export function assess(whiteScore: Score): Assessment {
  if (whiteScore.kind === 'gameover') {
    if (whiteScore.outcome === 'draw') return { text: 'Hòa', side: null, mateIn: null }
    const side: Color = whiteScore.outcome === 'win' ? 'w' : 'b'
    return { text: `Chiếu hết · ${NAME[side]} thắng`, side, mateIn: null }
  }
  if (whiteScore.kind === 'mate') {
    const side: Color = whiteScore.value > 0 ? 'w' : 'b'
    const n = Math.abs(whiteScore.value)
    return { text: `${NAME[side]} chiếu hết sau ${n} nước`, side, mateIn: n }
  }
  const edge = winPercent(whiteScore) - 50
  const side: Color = edge > 0 ? 'w' : 'b'
  const size = Math.abs(edge)
  if (size < SLIGHT) return { text: 'Cân bằng', side: null, mateIn: null }
  const text = size < CLEAR ? 'nhỉnh hơn' : size < CRUSHING ? 'ưu thế' : 'thắng thế áp đảo'
  return { text: `${NAME[side]} ${text}`, side, mateIn: null }
}

/**
 * Người đi đã có đòn chiếu hết (theo eval trước nước đi) nhưng nước vừa đi làm mất nó.
 * Trả về số nước của đòn chiếu hết bị bỏ lỡ, hoặc null.
 */
export function missedMate(before: PositionEval, after: PositionEval, mover: Color): number | null {
  const had = scoreForMover(before.score, mover)
  if (had.kind !== 'mate' || had.value <= 0) return null
  const now = scoreForMover(after.score, mover)
  const stillMating = (now.kind === 'mate' && now.value > 0) || (now.kind === 'gameover' && now.outcome === 'win')
  return stillMating ? null : had.value
}
