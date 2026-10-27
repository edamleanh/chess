import type { Opening } from '../openings/openings'

interface GameHeaderProps {
  headers: Record<string, string>
  opening: Opening | null
}

/** chess.js điền "?" cho các header bắt buộc bị thiếu. */
function value(headers: Record<string, string>, key: string): string | undefined {
  const v = headers[key]
  return v && v !== '?' && !v.startsWith('????') ? v : undefined
}

function player(headers: Record<string, string>, color: 'White' | 'Black'): string {
  const name = value(headers, color) ?? (color === 'White' ? 'Trắng' : 'Đen')
  const elo = value(headers, `${color}Elo`)
  return elo ? `${name} (${elo})` : name
}

export function GameHeader({ headers, opening }: GameHeaderProps) {
  const result = value(headers, 'Result') ?? '*'
  const event = [value(headers, 'Event'), value(headers, 'Date')].filter(Boolean).join(' · ')

  return (
    <header className="game-header">
      <div className="game-header__players">
        <span>♔ {player(headers, 'White')}</span>
        <strong className="game-header__result">{result}</strong>
        <span>♚ {player(headers, 'Black')}</span>
      </div>
      {opening && (
        <div className="game-header__opening">
          <span className="game-header__eco">{opening.eco}</span> {opening.name}
        </div>
      )}
      {event && <div className="game-header__event">{event}</div>}
    </header>
  )
}
