import { useMemo } from 'react'
import { missedMate } from '../analysis/assessment'
import type { MoveReview } from '../analysis/classifyMove'
import { MOVE_CLASS_META } from '../analysis/moveClassMeta'
import { pvToSan } from '../chess/pvToSan'
import type { Opening } from '../openings/openings'
import type { Ply, PositionEval } from '../types'
import { AiExplain } from './AiExplain'
import { MoveBadge } from './MoveBadge'

interface MoveFeedbackProps {
  /** Nước vừa đi tới vị trí đang xem; null ở thế cờ ban đầu. */
  move: Ply | null
  review: MoveReview | null
  /** Eval batch của vị trí trước/sau nước đi (để giải thích bằng AI). */
  before: PositionEval | null
  after: PositionEval | null
  /** Khai cuộc tính tới nước này (không phải khai cuộc sâu nhất của cả ván). */
  opening: Opening | null
}

/** Nhận xét nước vừa đi: nhãn, nước nên đi (nếu không phải nước tốt nhất), và giải thích bằng AI. */
export function MoveFeedback({ move, review, before, after, opening }: MoveFeedbackProps) {
  const bestSan = useMemo(
    () => (move && review?.bestMoveUci ? (pvToSan(move.fenBefore, [review.bestMoveUci])[0] ?? null) : null),
    [move, review],
  )
  const explainInput = useMemo(
    () => (move && review && before && after ? { ply: move, review, before, after, opening } : null),
    [move, review, before, after, opening],
  )

  // Bỏ lỡ đòn chiếu hết: hiện đường chiếu hết của engine (biến chính tốt nhất trước nước đi)
  const missed = move && before && after ? missedMate(before, after, move.color) : null
  const mateLine = useMemo(
    () => (missed && move && before?.lines[0] ? pvToSan(move.fenBefore, before.lines[0].pv.slice(0, missed * 2 - 1)) : []),
    [missed, move, before],
  )

  if (!move) return <div className="feedback feedback--muted">Thế cờ ban đầu</div>
  if (!review) return <div className="feedback feedback--muted">{move.san}: đang phân tích…</div>

  const meta = MOVE_CLASS_META[review.class]
  const isBook = review.class === 'book'
  const showBest = !isBook && bestSan && review.bestMoveUci !== move.uci && review.class !== 'brilliant'
  return (
    <div className="feedback">
      <div className="feedback__main">
        <MoveBadge cls={review.class} />
        {isBook ? (
          <span>
            <strong>{move.san}</strong> là nước khai cuộc{opening && <> · {opening.name}</>}
          </span>
        ) : (
          <span>
            <strong>{move.san}</strong> là nước <strong>{meta.label.toLowerCase()}</strong>
          </span>
        )}
      </div>
      {missed !== null && (
        <div className="feedback__mate" role="note">
          <strong>Bỏ lỡ chiếu hết sau {missed} nước</strong>
          {mateLine.length > 0 && <span>: {mateLine.join(' ')}</span>}
        </div>
      )}
      {showBest && missed === null && (
        <div className="feedback__best">
          Nước tốt nhất: <strong>{bestSan}</strong>
        </div>
      )}
      {explainInput && !isBook && <AiExplain key={move.index} input={explainInput} />}
    </div>
  )
}
