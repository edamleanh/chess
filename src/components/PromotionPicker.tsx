import { defaultPieces } from 'react-chessboard'
import type { Color } from '../types'

/** Thứ tự như chess.com: Hậu, Mã, Xe, Tượng (tính từ ô phong cấp vào giữa bàn). */
const PROMOTION_PIECES = [
  { piece: 'q', name: 'Hậu' },
  { piece: 'n', name: 'Mã' },
  { piece: 'r', name: 'Xe' },
  { piece: 'b', name: 'Tượng' },
] as const

interface PromotionPickerProps {
  color: Color
  /** Ô phong cấp (vd. "e8"): cột chọn quân mọc ra từ ô này. */
  square: string
  orientation: 'white' | 'black'
  onPick: (piece: string) => void
  onCancel: () => void
}

/**
 * Chọn quân phong cấp kiểu chess.com: một cột 4 quân ngay trên cột của ô phong cấp, kèm nút ✕ ở cuối.
 * Bấm ra ngoài cũng là hủy. Không tự phong Hậu.
 */
export function PromotionPicker({ color, square, orientation, onPick, onCancel }: PromotionPickerProps) {
  const file = square.charCodeAt(0) - 97
  const column = orientation === 'white' ? file : 7 - file
  // Ô phong cấp nằm ở mép trên khi bên phong cấp ở phía dưới bàn cờ, ngược lại ở mép dưới
  const fromTop = (color === 'w') === (orientation === 'white')

  return (
    <div className="promotion" role="dialog" aria-label="Chọn quân phong cấp" onClick={onCancel}>
      <div
        className={fromTop ? 'promotion__column' : 'promotion__column promotion__column--bottom'}
        style={{ left: `${column * 12.5}%` }}
        onClick={(e) => e.stopPropagation()}
      >
        {PROMOTION_PIECES.map((p) => {
          const Piece = defaultPieces[`${color}${p.piece.toUpperCase()}`]
          return (
            <button key={p.piece} type="button" className="promotion__piece" onClick={() => onPick(p.piece)} aria-label={p.name} title={p.name}>
              <Piece />
            </button>
          )
        })}
        <button type="button" className="promotion__cancel" onClick={onCancel} aria-label="Hủy" title="Hủy">
          ✕
        </button>
      </div>
    </div>
  )
}
