import type { PositionEval, Ply } from '../types'
import { moveAccuracy } from './accuracy'
import { scoreForMover } from './perspective'
import { isSacrifice } from './sacrifice'
import {
  BRILLIANT_MAX_DROP,
  BRILLIANT_MIN_WIN_AFTER,
  CRUSHING_WIN,
  EXCELLENT_MAX_DROP,
  GOOD_MAX_DROP,
  INACCURACY_MAX_DROP,
  LOSING_BELOW,
  MISTAKE_MAX_DROP,
  WINNING_ABOVE,
} from './thresholds'
import { winPercent } from './winPercent'

export type MoveClass =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'

export interface MoveReview {
  class: MoveClass
  /** win% theo góc nhìn người đi. */
  winBefore: number
  winAfter: number
  /** Mức tụt win% (≥ 0). */
  drop: number
  accuracy: number
  /** Nước tốt nhất của engine tại vị trí trước nước đi. */
  bestMoveUci: string | null
}

export interface MoveContext {
  /** Nước ngay trước đó (của đối phương), để nhận ra nước ăn lại quân. */
  previous?: Ply
  /** Nhãn (của engine) cho nước trước đó. */
  previousClass?: MoveClass
}

/**
 * Đối phương vừa đi nước dở thế này thì người đi có "cơ hội" (dùng cho Miss). Tính cả Miss: bỏ lỡ cơ hội
 * cũng làm thế cờ rơi xuống vùng tệ hơn, tức là trả lại cơ hội cho bên kia.
 */
const OPPONENT_ERRORS: MoveClass[] = ['mistake', 'miss', 'blunder']

/** Vùng kết quả theo cơ hội thắng của người đi: 0 thua, 1 cân bằng, 2 thắng. */
export function outcomeZone(win: number): 0 | 1 | 2 {
  return win < LOSING_BELOW ? 0 : win > WINNING_ABOVE ? 2 : 1
}

/**
 * Chấm một nước theo cách chess.com công bố. `before` là eval của ply.fenBefore, `after` là eval của
 * ply.fenAfter (góc nhìn Trắng). Mọi so sánh dùng win% theo góc nhìn người vừa đi (ply.color),
 * coi như "expected points" của chess.com (họ không công bố công thức theo rating).
 */
export function classifyMove(
  ply: Ply,
  before: PositionEval,
  after: PositionEval,
  context: MoveContext = {},
): MoveReview {
  const mover = (e: { score: PositionEval['score'] }) => winPercent(scoreForMover(e.score, ply.color))
  const winBefore = mover(before)
  const winAfter = mover(after)
  const drop = Math.max(0, winBefore - winAfter)
  const isBest = before.bestMove === ply.uci
  const firstWin = before.lines[0] ? mover(before.lines[0]) : winBefore
  const secondWin = before.lines[1] ? mover(before.lines[1]) : null
  // win% của nước tốt nhất KHÁC nước đã đi (nước đã đi có thể là biến 1 hoặc biến 2)
  const alternativeWin = isBest || before.lines[0]?.pv[0] === ply.uci ? secondWin : firstWin

  return {
    class: pickClass(),
    winBefore,
    winAfter,
    drop,
    accuracy: moveAccuracy(winBefore, winAfter),
    bestMoveUci: before.bestMove,
  }

  function pickClass(): MoveClass {
    // Brilliant: thí quân tốt, tốt nhất hoặc gần như vậy, sau đó không xấu thế,
    // và nếu không đi nước này thì chưa thắng tuyệt đối
    const neededMove = (alternativeWin ?? winBefore) < CRUSHING_WIN
    if (
      drop <= BRILLIANT_MAX_DROP &&
      winAfter >= BRILLIANT_MIN_WIN_AFTER &&
      neededMove &&
      isSacrifice(ply.fenBefore, ply.uci)
    ) {
      return 'brilliant'
    }

    // Great: nước quyết định kết quả: là nước tốt nhất và mọi nước khác đều rơi xuống vùng kết quả tệ hơn
    // (cứu thế thua về cân bằng, biến cân bằng thành thắng, hoặc nước tốt duy nhất).
    // Chiếu hết và ăn lại quân ngay là nước hiển nhiên, không tính.
    const obvious = ply.san.endsWith('#') || (ply.san.includes('x') && context.previous?.to === ply.to)
    if (isBest && !obvious && secondWin !== null && outcomeZone(firstWin) > outcomeZone(secondWin)) return 'great'
    if (isBest) return 'best'

    // Miss: đối phương vừa đi dở mà không tận dụng được: thế cờ rơi xuống vùng kết quả tệ hơn
    const opponentErred = context.previousClass !== undefined && OPPONENT_ERRORS.includes(context.previousClass)
    if (opponentErred && drop > GOOD_MAX_DROP && outcomeZone(winAfter) < outcomeZone(winBefore)) return 'miss'

    if (drop <= EXCELLENT_MAX_DROP) return 'excellent'
    if (drop <= GOOD_MAX_DROP) return 'good'
    if (drop <= INACCURACY_MAX_DROP) return 'inaccuracy'
    if (drop <= MISTAKE_MAX_DROP) return 'mistake'
    return 'blunder'
  }
}
