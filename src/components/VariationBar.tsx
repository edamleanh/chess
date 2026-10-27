import type { MoveReview } from '../analysis/classifyMove'
import type { Variation } from '../chess/exploration'
import type { Ply } from '../types'
import { MoveBadge } from './MoveBadge'

interface VariationBarProps {
  variation: Variation
  /** Nước của ván chính tại điểm rẽ nhánh (nước người chơi thật sự đã đi), null nếu rẽ từ cuối ván. */
  mainMove: Ply | null
  reviews: (MoveReview | null)[]
  onSelect: (cursor: number) => void
  onExit: () => void
}

function label(p: Ply, showNumber: boolean): string {
  if (p.color === 'w') return `${p.moveNumber}. ${p.san}`
  return showNumber ? `${p.moveNumber}... ${p.san}` : p.san
}

/** Biến phụ đang thử: các nước (kèm nhãn), bấm để nhảy tới, và nút quay về ván chính. */
export function VariationBar({ variation, mainMove, reviews, onSelect, onExit }: VariationBarProps) {
  return (
    <section className="variation" aria-label="Biến phụ đang thử">
      <div className="variation__header">
        <span>
          Đang thử nước khác
          {mainMove && (
            <span className="variation__muted"> (trong ván: {label(mainMove, true)})</span>
          )}
        </span>
        <button type="button" onClick={onExit}>
          ↩ Về ván chính
        </button>
      </div>
      <ol className="variation__moves">
        {variation.moves.map((m, i) => {
          const review = reviews[i]
          const active = variation.cursor === i + 1
          return (
            <li key={`${i}-${m.uci}`}>
              <button
                type="button"
                className={active ? 'variation__move variation__move--active' : 'variation__move'}
                aria-current={active ? 'step' : undefined}
                onClick={() => onSelect(i + 1)}
              >
                {label(m, i === 0)}
                {review ? <MoveBadge cls={review.class} /> : <span className="variation__pending" aria-label="đang phân tích">…</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
