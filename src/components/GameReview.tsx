import { lazy, Suspense, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BAD_CLASSES } from '../analysis/moveClassMeta'
import type { QualityId } from '../analysis/quality'
import { averageTime, clocksAt, timeSpent } from '../chess/clocks'
import { materialFromFen } from '../chess/material'
import { sideToMove } from '../engine/uci'
import { useEngineAnalysis } from '../hooks/useEngineAnalysis'
import { useGameAnalysis } from '../hooks/useGameAnalysis'
import { useGameNavigation } from '../hooks/useGameNavigation'
import { useMoveSound } from '../hooks/useMoveSound'
import { useOpening } from '../hooks/useOpening'
import { useVariationReview } from '../hooks/useVariationReview'
import type { Color, GameModel } from '../types'
import { AssessmentBar } from './AssessmentBar'
import { Board, type BoardArrow, type Orientation } from './Board'
import { EngineLines, EngineStatusRow } from './EngineLines'
import { GameHeader } from './GameHeader'
import { MoveFeedback } from './MoveFeedback'
import { MoveStrip } from './MoveStrip'
import { PlayerBar, type PlayerInfo } from './PlayerBar'
import { ReviewSummary } from './ReviewSummary'
import { VariationBar } from './VariationBar'

/** Thông tin đi kèm ván, tùy nguồn. */
export interface GameMeta {
  /** Hướng bàn cờ ban đầu (vd. theo màu của người chơi chess.com). */
  orientation?: Orientation
  /** Accuracy do nguồn khác tính (chess.com), để so sánh. */
  reference?: Record<Color, number>
  sourceUrl?: string
}

interface GameReviewProps {
  game: GameModel
  meta: GameMeta
  engineEnabled: boolean
  onEngineToggle: (enabled: boolean) => void
  quality: QualityId
  onQualityChange: (quality: QualityId) => void
  /** Chỗ trong cột phải (do App giữ) để hiện phần "Phân tích" của ván. */
  analysisSlot: HTMLElement | null
  soundEnabled: boolean
  onSoundToggle: () => void
  /** Màn review đang hiển thị (false khi đang ở chế độ luyện tập): tắt phím tắt. */
  active?: boolean
}

// recharts khá nặng (~360 KB): tách thành chunk riêng để bàn cờ hiện ngay
const EvalChart = lazy(() => import('./EvalChart').then((m) => ({ default: m.EvalChart })))

const LIVE_ARROW = 'rgba(40, 130, 220, 0.75)'
const SUGGESTION_ARROW = 'rgba(70, 160, 60, 0.85)'

function header(game: GameModel, key: string): string | null {
  const v = game.headers[key]
  return v && v !== '?' ? v : null
}

export function GameReview(props: GameReviewProps) {
  const { game, meta, engineEnabled, onEngineToggle, quality, onQualityChange, analysisSlot, soundEnabled, onSoundToggle, active = true } =
    props
  const nav = useGameNavigation(game, active)
  const [orientation, setOrientation] = useState<Orientation>(meta.orientation ?? 'white')
  const openingInfo = useOpening(game)
  const gameAnalysis = useGameAnalysis(game, quality, openingInfo.bookPlies)
  const variationReview = useVariationReview(game, nav.variation, gameAnalysis.evals)
  const times = useMemo(() => timeSpent(game), [game])

  // Nước đang xem: trong biến phụ hoặc trên ván chính. Mọi thông tin bên dưới đi theo nước này.
  const cursor = nav.variation?.cursor ?? 0
  const current = nav.inVariation
    ? {
        review: variationReview.reviews[cursor - 1] ?? null,
        before: variationReview.evals[cursor - 1] ?? null,
        after: variationReview.evals[cursor] ?? null,
        opening: null,
      }
    : {
        review: nav.ply > 0 ? gameAnalysis.review.moves[nav.ply - 1] : null,
        before: nav.ply > 0 ? gameAnalysis.evals[nav.ply - 1] : null,
        after: gameAnalysis.evals[nav.ply],
        opening: nav.ply > 0 ? (openingInfo.byPly[nav.ply - 1] ?? openingInfo.opening) : null,
      }
  const { analysis, status, fen } = useEngineAnalysis(nav.position, engineEnabled, current.after)
  useMoveSound(nav.lastMove, soundEnabled)

  const arrows: BoardArrow[] = []
  // Nước vừa đi là nước dở: chỉ nước nên đi (mũi tên xanh lá)
  if (current.review?.bestMoveUci && BAD_CLASSES.includes(current.review.class)) {
    arrows.push({ uci: current.review.bestMoveUci, color: SUGGESTION_ARROW })
  }
  if (engineEnabled && analysis.bestMoveUci) arrows.push({ uci: analysis.bestMoveUci, color: LIVE_ARROW })

  // Thanh người chơi: đồng hồ theo ván chính (biến phụ không có đồng hồ), quân đã ăn theo vị trí đang xem
  const clocks = clocksAt(game, nav.ply)
  const material = materialFromFen(nav.fen)
  const player = (color: Color): PlayerInfo => ({
    name: header(game, color === 'w' ? 'White' : 'Black') ?? (color === 'w' ? 'Trắng' : 'Đen'),
    rating: header(game, color === 'w' ? 'WhiteElo' : 'BlackElo'),
    clock: nav.inVariation ? null : clocks[color],
    captured: material.captured[color],
    advantage: material.advantage[color],
  })

  return (
    <>
      <aside className="layout__left">
        <Suspense fallback={<div className="chart card chart--loading" />}>
          <EvalChart
            plies={game.plies}
            evals={gameAnalysis.evals}
            reviews={gameAnalysis.review.moves}
            times={times}
            ply={nav.ply}
            onSelect={nav.goTo}
          />
        </Suspense>
        <EngineStatusRow analysis={analysis} status={status} enabled={engineEnabled} onToggle={onEngineToggle} />
        <ReviewSummary
          headers={game.headers}
          status={gameAnalysis.status}
          analyzed={gameAnalysis.analyzed}
          total={gameAnalysis.total}
          pool={gameAnalysis.pool}
          review={gameAnalysis.review}
          reference={meta.reference}
          averageTime={{ w: averageTime(game, times, 'w'), b: averageTime(game, times, 'b') }}
          sourceUrl={meta.sourceUrl}
          quality={quality}
          onQualityChange={onQualityChange}
        />
        <details className="shortcuts card">
          <summary>Phím tắt</summary>
          <dl>
            <dt>
              <kbd>←</kbd> <kbd>→</kbd>
            </dt>
            <dd>Nước trước / nước sau</dd>
            <dt>
              <kbd>Home</kbd> <kbd>End</kbd>
            </dt>
            <dd>Về đầu / cuối ván (hoặc cuối biến phụ)</dd>
            <dt>Kéo hoặc bấm quân</dt>
            <dd>Thử nước khác (mở biến phụ)</dd>
          </dl>
        </details>
      </aside>

      <section className="layout__center" aria-label="Bàn cờ">
        <PlayerBar white={player('w')} black={player('b')} toMove={sideToMove(nav.fen)} />
        <AssessmentBar score={engineEnabled || analysis.gameOver ? analysis.barScore : null} />
        <div className="board-frame">
          <Board
            fen={nav.fen}
            lastMove={nav.lastMove}
            lastMoveClass={current.review?.class ?? null}
            orientation={orientation}
            arrows={arrows}
            onMove={nav.playMove}
          />
        </div>
        <MoveStrip
          plies={game.plies}
          reviews={gameAnalysis.review.moves}
          ply={nav.ply}
          atStart={nav.atStart}
          atEnd={nav.atEnd}
          onSelect={nav.goTo}
          onPrev={nav.goPrev}
          onNext={nav.goNext}
          onFlip={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
          soundEnabled={soundEnabled}
          onSoundToggle={onSoundToggle}
        />
      </section>

      {analysisSlot &&
        createPortal(
          <>
            <GameHeader headers={game.headers} opening={openingInfo.opening} />
            {nav.variation && (
              <VariationBar
                variation={nav.variation}
                mainMove={game.plies[nav.variation.fromPly] ?? null}
                reviews={variationReview.reviews}
                onSelect={nav.goToVariation}
                onExit={nav.exitVariation}
              />
            )}
            <MoveFeedback
              move={nav.lastMove}
              review={current.review}
              before={current.before}
              after={current.after}
              opening={current.opening}
            />
            <EngineLines fen={fen} analysis={analysis} enabled={engineEnabled} />
          </>,
          analysisSlot,
        )}
    </>
  )
}
