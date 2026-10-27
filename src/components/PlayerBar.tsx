import { formatClock } from '../chess/clocks'
import type { CapturedPiece } from '../chess/material'
import type { Color } from '../types'

export interface PlayerInfo {
  name: string
  rating: string | null
  clock: number | null
  /** Quân của đối phương mà người này đã ăn. */
  captured: CapturedPiece[]
  /** Hơn vật chất bao nhiêu (chỉ hiện khi > 0). */
  advantage: number
}

/** Ký hiệu quân bị ăn: quân của bên kia, nên Trắng ăn thì hiện quân đen và ngược lại. */
const GLYPH: Record<Color, Record<CapturedPiece, string>> = {
  w: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' },
  b: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },
}

interface PlayerBarProps {
  white: PlayerInfo
  black: PlayerInfo
  /** Bên đang tới lượt ở vị trí đang xem. */
  toMove: Color
}

/** Hai người chơi đối diện: Trắng bên trái, Đen bên phải (tên, rating, đồng hồ, quân đã ăn). */
export function PlayerBar({ white, black, toMove }: PlayerBarProps) {
  return (
    <div className="players">
      <Player info={white} color="w" active={toMove === 'w'} />
      <Player info={black} color="b" active={toMove === 'b'} />
    </div>
  )
}

function Player({ info, color, active }: { info: PlayerInfo; color: Color; active: boolean }) {
  return (
    <div className={`player player--${color}`}>
      <span className={`player__avatar player__avatar--${color}`} aria-hidden="true">
        {info.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="player__info">
        <span className="player__name">
          {info.name}
          {info.rating && <span className="player__rating"> ({info.rating})</span>}
        </span>
        <span className="player__meta">
          {info.clock !== null && (
            <span className={active ? 'player__clock player__clock--active' : 'player__clock'}>
              {formatClock(info.clock)}
            </span>
          )}
          {info.captured.length > 0 && (
            <span className="player__captured" aria-label={`Đã ăn ${info.captured.length} quân`}>
              {info.captured.map((p) => GLYPH[color][p]).join('')}
            </span>
          )}
          {info.advantage > 0 && <span className="player__advantage">+{info.advantage}</span>}
        </span>
      </div>
    </div>
  )
}
