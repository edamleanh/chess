import type { Color, GameModel, PositionEval } from '../types'
import { gameAccuracy } from './accuracy'
import { classifyMove, type MoveClass, type MoveReview } from './classifyMove'
import { winPercent } from './winPercent'

export const MOVE_CLASSES: MoveClass[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
]

export interface GameReview {
  /** moves[i] là đánh giá của game.plies[i]; null khi chưa đủ eval. */
  moves: (MoveReview | null)[]
  /** Chỉ có khi mọi vị trí đã được phân tích. */
  accuracy: Record<Color, number | null> | null
  counts: Record<Color, Record<MoveClass, number>>
}

/**
 * Chấm cả ván từ eval của từng vị trí: evals[0] là thế cờ đầu, evals[i] là sau nước thứ i.
 * Chạy được với kết quả một phần (vị trí chưa phân tích là null).
 * `bookPlies` nước đầu (theo dữ liệu khai cuộc) luôn nhận nhãn Book như chess.com, kể cả gambit mà engine
 * chấm dở; win%/accuracy của chúng vẫn tính như thường. Ngữ cảnh cho nước sau (luật Miss) dùng nhãn gốc của engine.
 */
export function reviewGame(game: GameModel, evals: (PositionEval | null)[], bookPlies = 0): GameReview {
  const moves: (MoveReview | null)[] = []
  const engineClasses: (MoveClass | undefined)[] = []
  game.plies.forEach((ply, i) => {
    const before = evals[i]
    const after = evals[i + 1]
    const context = { previous: game.plies[i - 1], previousClass: engineClasses[i - 1] }
    const review = before && after ? classifyMove(ply, before, after, context) : null
    engineClasses.push(review?.class)
    moves.push(review && i < bookPlies ? { ...review, class: 'book' } : review)
  })

  const counts = { w: emptyCounts(), b: emptyCounts() }
  moves.forEach((m, i) => {
    if (m) counts[game.plies[i].color][m.class]++
  })

  const complete = evals.length === game.plies.length + 1 && evals.every((e) => e !== null)
  const accuracy =
    complete && game.plies.length > 0
      ? gameAccuracy(
          (evals as PositionEval[]).map((e) => winPercent(e.score)),
          game.plies[0].color,
        )
      : null

  return { moves, accuracy, counts }
}

function emptyCounts(): Record<MoveClass, number> {
  return Object.fromEntries(MOVE_CLASSES.map((c) => [c, 0])) as Record<MoveClass, number>
}
