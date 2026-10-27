import { useState } from 'react'
import type { QualityId } from './analysis/quality'
import type { GameSummary } from './api/chessCom'
import { parsePgn } from './chess/parsePgn'
import type { Orientation } from './components/Board'
import { GameReview, type GameMeta } from './components/GameReview'
import { GameSource } from './components/GameSource'
import { TrainingMode } from './components/TrainingMode'
import type { GameModel } from './types'
import './App.css'

interface LoadedGame {
  id: number
  model: GameModel
  meta: GameMeta
}

type RightTab = 'analysis' | 'games'
type Mode = 'review' | 'training'

const SOUND_KEY = 'chess-review:sound'

/** Tùy chọn âm thanh của người xem (mặc định bật); localStorage bị chặn thì vẫn chạy với mặc định. */
function readSoundSetting(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

function saveSoundSetting(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // không lưu được: chỉ áp dụng trong phiên này
  }
}

/**
 * Bố cục 3 cột: trái (biểu đồ, engine, tổng kết), giữa (người chơi, bàn cờ, dải nước đi), phải (phân tích | chọn ván).
 * App giữ cột phải để khung chọn ván không bị mount lại mỗi khi đổi ván; phần "Phân tích" của GameReview
 * được render vào cột phải qua portal.
 */
export default function App() {
  const [game, setGame] = useState<LoadedGame | null>(null)
  const [pgnError, setPgnError] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const [engineEnabled, setEngineEnabled] = useState(true)
  const [quality, setQuality] = useState<QualityId>('standard')
  const [tab, setTab] = useState<RightTab>('games')
  const [analysisSlot, setAnalysisSlot] = useState<HTMLDivElement | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(readSoundSetting)
  const [mode, setMode] = useState<Mode>('review')
  // Màn luyện tập chỉ mount khi mở lần đầu (kho puzzle, engine), sau đó giữ nguyên trạng thái
  const [trainingOpened, setTrainingOpened] = useState(false)

  function openMode(next: Mode) {
    setMode(next)
    if (next === 'training') setTrainingOpened(true)
  }

  function toggleSound() {
    setSoundEnabled((on) => {
      saveSoundSetting(!on)
      return !on
    })
  }

  function show(model: GameModel, meta: GameMeta) {
    setPickError(null)
    setPgnError(null)
    setGame((prev) => ({ id: (prev?.id ?? 0) + 1, model, meta }))
    setTab('analysis')
    window.scrollTo({ top: 0, behavior: 'smooth' }) // mobile: bàn cờ nằm trên cùng
  }

  function handleLoadPgn(pgn: string) {
    const result = parsePgn(pgn)
    if (!result.ok) return setPgnError(result.error)
    show(result.game, {})
  }

  function handlePickChessCom(summary: GameSummary) {
    const result = parsePgn(summary.pgn)
    if (!result.ok) return setPickError(`Không đọc được ván này: ${result.error}`)
    const orientation: Orientation = summary.userColor === 'w' ? 'white' : 'black'
    show(result.game, { orientation, reference: summary.chessComAccuracy, sourceUrl: summary.url })
  }

  const tabButton = (id: RightTab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      className={tab === id ? 'tabs__tab tabs__tab--active' : 'tabs__tab'}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  )

  return (
    <div className={mode === 'training' ? 'app app--wide' : 'app'}>
      <header className="app__header">
        <h1 className="app__title">
          <span className="app__logo" aria-hidden="true">
            ♞
          </span>
          Chess Review
        </h1>
        <nav className="modes" role="tablist" aria-label="Chế độ">
          {(
            [
              ['review', 'Review ván'],
              ['training', 'Luyện chiếu hết'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={mode === id ? 'modes__tab modes__tab--active' : 'modes__tab'}
              onClick={() => openMode(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* Màn review chỉ bị ẩn khi sang luyện tập: ván đang xem và kết quả phân tích được giữ nguyên */}
      <div className="layout" hidden={mode !== 'review'}>
        {game ? (
          <GameReview
            key={game.id}
            game={game.model}
            meta={game.meta}
            engineEnabled={engineEnabled && mode === 'review'}
            onEngineToggle={setEngineEnabled}
            quality={quality}
            onQualityChange={setQuality}
            analysisSlot={analysisSlot}
            soundEnabled={soundEnabled && mode === 'review'}
            onSoundToggle={toggleSound}
            active={mode === 'review'}
          />
        ) : (
          <section className="layout__center">
            <ol className="welcome">
              <li>
                <strong>Chọn ván</strong>
                <span>Bấm một ván trong danh sách bên phải, hoặc dán PGN (có sẵn “Ván mẫu”).</span>
              </li>
              <li>
                <strong>Stockfish phân tích</strong>
                <span>Từng nước được chấm từ Thiên tài tới Sai lầm nghiêm trọng, kèm Accuracy.</span>
              </li>
              <li>
                <strong>Xem lại và thử nước khác</strong>
                <span>Dùng ← → để đi từng nước, kéo quân để thử nước khác, hỏi AI vì sao.</span>
              </li>
            </ol>
          </section>
        )}

        <aside className="layout__right card">
          <div className="tabs" role="tablist" aria-label="Bảng bên phải">
            {game && tabButton('analysis', 'Phân tích')}
            {tabButton('games', 'Chọn ván')}
          </div>
          <div ref={setAnalysisSlot} className="right__panel" hidden={tab !== 'analysis' || !game} />
          <div className="right__panel" hidden={tab !== 'games'}>
            <GameSource pgnError={pgnError} onLoadPgn={handleLoadPgn} onPickChessCom={handlePickChessCom} />
            {pickError && (
              <p className="app__error" role="alert">
                {pickError}
              </p>
            )}
          </div>
        </aside>
      </div>

      {trainingOpened && (
        <div className="layout layout--training" hidden={mode !== 'training'}>
          <TrainingMode active={mode === 'training'} soundEnabled={soundEnabled} />
        </div>
      )}
    </div>
  )
}
