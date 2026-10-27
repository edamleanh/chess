import { useState } from 'react'
import {
  ChessComError,
  formatTimeControl,
  normalizeUsername,
  TIME_CLASS_LABEL,
  timeClassLabel,
  type GameSummary,
  type TimeClass,
} from '../api/chessCom'
import { PAGE_SIZE } from '../api/chessComLoader'
import { DEFAULT_CHESSCOM_USERNAME } from '../config'
import { useChessComGames, type ChessComSearch } from '../hooks/useChessComGames'
import { chessComListView } from './chessComListView'

type Filter = 'all' | TimeClass

const FILTERS: [Filter, string][] = [['all', 'Tất cả'], ...(Object.entries(TIME_CLASS_LABEL) as [TimeClass, string][])]

const OUTCOME_LABEL = { win: 'Thắng', loss: 'Thua', draw: 'Hòa' } as const

const dateFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

interface ChessComImportProps {
  onPick: (game: GameSummary) => void
}

export function ChessComImport({ onPick }: ChessComImportProps) {
  const [input, setInput] = useState(DEFAULT_CHESSCOM_USERNAME)
  // Mở app là tải sẵn ván của người dùng mặc định
  const [search, setSearch] = useState<ChessComSearch | null>({ id: 1, username: DEFAULT_CHESSCOM_USERNAME })
  const [inputError, setInputError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const { status, games, hasMore, error, retryable, oldestMonth, loadMore } = useChessComGames(search)

  const matches = (g: GameSummary) => filter === 'all' || g.timeClass === filter
  const loadMoreMatching = () => loadMore(matches)
  const filtered = games.filter(matches)
  const view = chessComListView({ status, games, filtered, visible, hasMore, error })

  function submit() {
    try {
      const username = normalizeUsername(input)
      setInputError(null)
      // id mới mỗi lần bấm Tìm: tìm lại cùng username cũng tải lại (lấy ván vừa chơi xong)
      setSearch((prev) => ({ id: (prev?.id ?? 0) + 1, username }))
      setFilter('all')
      setVisible(PAGE_SIZE)
    } catch (e) {
      setInputError(e instanceof ChessComError ? e.message : String(e))
    }
  }

  function showMore() {
    const next = Math.min(visible, filtered.length) + PAGE_SIZE
    setVisible(next)
    // Đã hiện gần hết ván đã tải: tải thêm tháng trước
    if (filtered.length < next && hasMore) loadMoreMatching()
  }

  return (
    <div className="chesscom">
      <form
        className="chesscom__search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label htmlFor="chesscom-username" className="visually-hidden">
          Username chess.com
        </label>
        <input
          id="chesscom-username"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Username chess.com, vd. hikaru"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="primary">
          Tìm
        </button>
      </form>
      {inputError && (
        <p className="chesscom__error" role="alert">
          {inputError}
        </p>
      )}

      {search && (
        <>
          <div className="chesscom__filters" role="group" aria-label="Lọc theo thể loại">
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? 'chip chip--active' : 'chip'}
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value)
                  setVisible(PAGE_SIZE)
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {view.shown.length > 0 && (
            <ul className="game-list" aria-label={`Ván của ${search.username}`}>
              {view.shown.map((g) => (
                <li key={g.id}>
                  <GameRow game={g} onPick={onPick} />
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="chesscom__error" role="alert">
              {error}{' '}
              {retryable && (
                <button type="button" onClick={loadMoreMatching}>
                  Thử lại
                </button>
              )}
            </p>
          )}

          {view.showMoreButton && (
            <button type="button" className="chesscom__more" onClick={showMore} disabled={status === 'loading'}>
              {status === 'loading' ? 'Đang tải…' : 'Tải thêm'}
            </button>
          )}
          {view.searchOlderButton && (
            <button type="button" className="chesscom__more" onClick={loadMoreMatching} disabled={status === 'loading'}>
              {status === 'loading' ? 'Đang tìm…' : 'Tìm trong các tháng trước'}
            </button>
          )}

          <div className="chesscom__status" role="status" aria-live="polite">
            {view.message && <p className="chesscom__muted">{view.message}</p>}
            {oldestMonth && (
              <p className="chesscom__muted chesscom__range">
                {hasMore ? `Đã tìm tới tháng ${oldestMonth}` : `Đã tải hết ván (từ tháng ${oldestMonth})`}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function GameRow({ game, onPick }: { game: GameSummary; onPick: (game: GameSummary) => void }) {
  const accuracy = game.chessComAccuracy
  const mode = `${timeClassLabel(game.timeClass)} ${formatTimeControl(game.timeControl)}`
  const date = dateFormat.format(game.endTime)
  // Nhãn tóm tắt cho trình đọc màn hình, thay vì đọc dồn từng ô
  const summary =
    `${OUTCOME_LABEL[game.userOutcome]}: ${game.white.name} (${game.white.rating}) cầm Trắng, ` +
    `${game.black.name} (${game.black.rating}) cầm Đen, ${mode}, ngày ${date}` +
    (accuracy ? `, Accuracy chess.com ${accuracy.w.toFixed(1)} và ${accuracy.b.toFixed(1)}` : '')

  return (
    <button type="button" className="game-row" onClick={() => onPick(game)} aria-label={summary}>
      <span className={`game-row__outcome game-row__outcome--${game.userOutcome}`}>
        <span className="game-row__dot" aria-hidden="true" />
        {OUTCOME_LABEL[game.userOutcome]}
      </span>
      <span className="game-row__players">
        <span>
          ♔ {game.white.name} <span className="game-row__rating">({game.white.rating})</span>
        </span>
        <span>
          ♚ {game.black.name} <span className="game-row__rating">({game.black.rating})</span>
        </span>
      </span>
      <span className="game-row__meta">
        <span>{mode}</span>
        <span>{date}</span>
        {accuracy && (
          <span title="Accuracy do chess.com tính">
            {accuracy.w.toFixed(1)} / {accuracy.b.toFixed(1)}
          </span>
        )}
      </span>
    </button>
  )
}
