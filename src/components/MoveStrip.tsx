import { useEffect, useRef } from 'react'
import type { MoveReview } from '../analysis/classifyMove'
import { NOTABLE_CLASSES } from '../analysis/moveClassMeta'
import type { Ply } from '../types'
import { MoveBadge } from './MoveBadge'

interface MoveStripProps {
  plies: Ply[]
  reviews: (MoveReview | null)[]
  /** Số ply đã đi trên ván chính (0 = thế cờ ban đầu). */
  ply: number
  atStart: boolean
  atEnd: boolean
  onSelect: (ply: number) => void
  onPrev: () => void
  onNext: () => void
  onFlip: () => void
  soundEnabled: boolean
  onSoundToggle: () => void
}

/** Dải nước đi nằm ngang dưới bàn cờ: nút lùi/tới, các nước (bấm để nhảy tới), nút lật bàn cờ. */
export function MoveStrip(props: MoveStripProps) {
  const { plies, reviews, ply, atStart, atEnd, onSelect, onPrev, onNext, onFlip, soundEnabled, onSoundToggle } = props
  const listRef = useRef<HTMLOListElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Giữ nước đang xem ở giữa dải; chỉ cuộn ngang bên trong dải, không cuộn trang
  useEffect(() => {
    const list = listRef.current
    const active = activeRef.current
    if (!list) return
    if (!active) {
      list.scrollLeft = 0
      return
    }
    list.scrollLeft = active.offsetLeft - list.clientWidth / 2 + active.offsetWidth / 2
  }, [ply])

  return (
    <nav className="strip" aria-label="Các nước đi">
      <button type="button" className="strip__flip" onClick={onFlip} aria-label="Lật bàn cờ" title="Lật bàn cờ">
        ⇅
      </button>
      <div className="strip__track">
        <button type="button" className="strip__nav" onClick={onPrev} disabled={atStart} aria-label="Nước trước" title="Nước trước (←)">
          ‹
        </button>
        <ol ref={listRef} className="strip__moves">
          {plies.map((p) => {
            const active = p.index + 1 === ply
            const cls = reviews[p.index]?.class
            return (
              <li key={p.index}>
                {p.color === 'w' && <span className="strip__number">{p.moveNumber}.</span>}
                <button
                  ref={active ? activeRef : undefined}
                  type="button"
                  className={active ? 'strip__move strip__move--active' : 'strip__move'}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => onSelect(p.index + 1)}
                >
                  {cls && NOTABLE_CLASSES.includes(cls) && <MoveBadge cls={cls} />}
                  {p.san}
                </button>
              </li>
            )
          })}
        </ol>
        <button type="button" className="strip__nav" onClick={onNext} disabled={atEnd} aria-label="Nước sau" title="Nước sau (→)">
          ›
        </button>
      </div>
      <button
        type="button"
        className="strip__flip"
        onClick={onSoundToggle}
        aria-pressed={soundEnabled}
        aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
        title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
      >
        <span aria-hidden="true">{soundEnabled ? '🔊' : '🔇'}</span>
      </button>
    </nav>
  )
}
