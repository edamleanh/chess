import { useRef, useState, type KeyboardEvent } from 'react'
import type { GameSummary } from '../api/chessCom'
import { ChessComImport } from './ChessComImport'
import { PgnInput } from './PgnInput'

type Tab = 'chesscom' | 'pgn'

const TABS: [Tab, string][] = [
  ['chesscom', 'chess.com'],
  ['pgn', 'Dán PGN'],
]

interface GameSourceProps {
  pgnError: string | null
  onLoadPgn: (pgn: string) => void
  onPickChessCom: (game: GameSummary) => void
}

/** Chọn nguồn ván: dán PGN hoặc kéo từ chess.com. Cả hai panel luôn được giữ để không mất dữ liệu đã nhập. */
export function GameSource({ pgnError, onLoadPgn, onPickChessCom }: GameSourceProps) {
  const [tab, setTab] = useState<Tab>('chesscom')
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})

  // Mẫu tab ARIA: ←/→/Home/End chuyển tab; chặn lan ra để không điều hướng nước đi của bàn cờ
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex(([id]) => id === tab)
    const next =
      e.key === 'ArrowRight' ? (index + 1) % TABS.length
      : e.key === 'ArrowLeft' ? (index - 1 + TABS.length) % TABS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? TABS.length - 1
      : null
    if (next === null) return
    e.preventDefault()
    e.stopPropagation()
    const id = TABS[next][0]
    setTab(id)
    tabRefs.current[id]?.focus()
  }

  return (
    <section className="source">
      <div className="tabs" role="tablist" aria-label="Nguồn ván cờ" onKeyDown={onKeyDown}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el
            }}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? 'tabs__tab tabs__tab--active' : 'tabs__tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="panel-chesscom" role="tabpanel" aria-labelledby="tab-chesscom" hidden={tab !== 'chesscom'}>
        <ChessComImport onPick={onPickChessCom} />
      </div>
      <div id="panel-pgn" role="tabpanel" aria-labelledby="tab-pgn" hidden={tab !== 'pgn'}>
        <PgnInput error={pgnError} onLoad={onLoadPgn} />
      </div>
    </section>
  )
}
