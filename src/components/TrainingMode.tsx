import { useState } from 'react'
import { MOVE_CLASS_META } from '../analysis/moveClassMeta'
import { makePly } from '../chess/exploration'
import { useLineReview } from '../hooks/useLineReview'
import { useTraining, type HistoryEntry } from '../hooks/useTraining'
import { ENDGAMES } from '../training/endgames'
import { EXERCISES, OPPONENT_DELAYS, TIME_LIMITS, isEndgame } from '../training/exercises'
import { displayFen, isOpponentTurn, isPlayerTurn, type Session, type Task } from '../training/session'
import { formatCountdown, remaining } from '../training/timer'
import { AssessmentBar } from './AssessmentBar'
import { Board } from './Board'
import { MoveBadge } from './MoveBadge'
import { TrainingBoard } from './TrainingBoard'

interface TrainingModeProps {
  active: boolean
  soundEnabled: boolean
}

const sideName = (c: 'w' | 'b') => (c === 'w' ? 'Trắng' : 'Đen')

/** Thế cờ sau các nước UCI tính từ `startFen`. */
function replayFen(startFen: string, moves: string[]): string | null {
  let fen = startFen
  for (const [i, uci] of moves.entries()) {
    const ply = makePly(fen, uci, i)
    if (!ply) return null
    fen = ply.fenAfter
  }
  return fen
}

function goalText(session: Session): string {
  if (session.task.kind === 'endgame') return `${ENDGAMES[session.task.endgame].label}: chiếu hết Vua đen`
  const solverMoves = Math.floor(session.task.puzzle.moves.length / 2)
  return `${sideName(session.player)} chiếu hết sau ${solverMoves} nước`
}

function turnText(session: Session): string {
  if (isPlayerTurn(session)) return `Tới lượt bạn (${sideName(session.player)})`
  if (isOpponentTurn(session)) {
    const queued = session.premoves.length
    return queued ? `Đối phương đang đi · ${queued} premove` : 'Đối phương đang đi · có thể premove'
  }
  return ''
}

const RESULT: Record<Exclude<Session['status'], 'playing'>, { title: string; tone: string }> = {
  solved: { title: 'Chính xác!', tone: 'training-result--ok' },
  failed: { title: 'Chưa đúng', tone: 'training-result--bad' },
  timeout: { title: 'Hết giờ', tone: 'training-result--bad' },
}

const HISTORY_MARK: Record<HistoryEntry['status'], { icon: string; label: string }> = {
  solved: { icon: '✓', label: 'Đúng' },
  failed: { icon: '✕', label: 'Sai' },
  timeout: { icon: '⏱', label: 'Hết giờ' },
}

const historyName = (task: Task) =>
  task.kind === 'puzzle' ? `Puzzle #${task.puzzle.id}` : ENDGAMES[task.endgame].label

const historyMeta = (task: Task) =>
  task.kind === 'puzzle' ? `M${Math.floor(task.puzzle.moves.length / 2)} · ${task.puzzle.rating}` : 'Stockfish'

/** Chế độ "Luyện chiếu hết": puzzle chiếu hết của lichess và chiếu hết cơ bản với Stockfish phòng thủ. */
export function TrainingMode({ active, soundEnabled }: TrainingModeProps) {
  const t = useTraining(active, soundEnabled)
  const { session, solution, analysis } = t
  const group = isEndgame(t.exercise) ? 'endgame' : 'puzzle'
  const progress = t.progress()

  const clockMs = session ? remaining(session.clock, Math.max(t.now, session.clock.runningSince ?? 0)) : t.limitSec * 1000
  const clockRunning = session?.status === 'playing' && session.clock.runningSince !== null
  const result = session && session.status !== 'playing' ? RESULT[session.status] : null

  // Stockfish chấm từng nước (như màn review): của bàn phân tích, hoặc của bài đang làm
  const [showEval, setShowEval] = useState(true)
  const line = analysis
    ? { startFen: analysis.startFen, moves: analysis.moves, cursor: analysis.cursor }
    : session
      ? { startFen: session.startFen, moves: session.moves, cursor: session.moves.length }
      : null
  const lineReview = useLineReview(line?.startFen ?? null, line?.moves ?? [], active && line !== null)
  const currentEval = line ? (lineReview.evals[line.cursor] ?? null) : null
  const currentReview = line && line.cursor > 0 ? (lineReview.reviews[line.cursor - 1] ?? null) : null
  const evalVisible = Boolean(analysis) || session?.status !== 'playing' || showEval
  // Nhận xét nước đang xem ở bàn phân tích: nhãn + nước tốt nhất nếu đi khác
  const feedback = (() => {
    if (!analysis || !currentReview || analysis.cursor === 0) return null
    const before = replayFen(analysis.startFen, analysis.moves.slice(0, analysis.cursor - 1))
    const best = before && currentReview.bestMoveUci ? makePly(before, currentReview.bestMoveUci, 0)?.san : null
    const played = analysis.sans[analysis.cursor - 1]
    return { played, cls: currentReview.class, best: best && best !== played ? best : null }
  })()

  return (
    <>
      <aside className="layout__left">
        <section className="card training-panel" aria-label="Chọn bài">
          <h2 className="training-panel__title">Bài tập</h2>
          {(['puzzle', 'endgame'] as const).map((g) => (
            <fieldset key={g} className="training-options">
              <legend>{g === 'puzzle' ? 'Puzzle chiếu hết (lichess)' : 'Chiếu hết cơ bản (đấu Stockfish)'}</legend>
              {EXERCISES.filter((e) => e.group === g).map((e) => (
                <label key={e.id} className="training-option">
                  <input
                    type="radio"
                    name="exercise"
                    checked={t.exercise === e.id}
                    // onClick (không phải onChange): bấm lại mục đang chọn cũng ra bài / thế cờ mới
                    readOnly
                    onClick={() => t.setExercise(e.id)}
                    disabled={t.loading}
                  />
                  {e.label}
                </label>
              ))}
              {g === 'puzzle' && progress && (
                <p className="training-note">
                  Đã gặp {progress.seen}/{progress.total} bài ở mục này. Không ra lại bài cũ cho tới khi gặp hết.
                </p>
              )}
            </fieldset>
          ))}
          <fieldset className="training-options">
            <legend>Thời gian mỗi bài</legend>
            <div className="training-limits">
              {TIME_LIMITS[group].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  aria-pressed={t.limitSec === sec}
                  className={t.limitSec === sec ? 'training-limit training-limit--active' : 'training-limit'}
                  onClick={() => t.setLimitSec(sec)}
                >
                  {sec < 60 ? `${sec} giây` : `${sec / 60} phút`}
                </button>
              ))}
            </div>
            <p className="training-note">Áp dụng từ bài tiếp theo.</p>
          </fieldset>
          <fieldset className="training-options">
            <legend>Đối phương nghĩ</legend>
            <div className="training-limits">
              {OPPONENT_DELAYS.map((ms) => (
                <button
                  key={ms}
                  type="button"
                  aria-pressed={t.opponentDelay === ms}
                  className={t.opponentDelay === ms ? 'training-limit training-limit--active' : 'training-limit'}
                  onClick={() => t.setOpponentDelay(ms)}
                >
                  {String(ms / 1000).replace('.', ',')} giây
                </button>
              ))}
            </div>
            <p className="training-note">Khoảng thời gian để bạn xếp premove.</p>
          </fieldset>
          <label className="training-option training-toggle">
            <input type="checkbox" checked={showEval} onChange={(e) => setShowEval(e.target.checked)} />
            Hiện thanh đánh giá khi đang làm bài
          </label>
          <label className="training-option training-toggle">
            <input type="checkbox" checked={t.autoAdvance} onChange={(e) => t.setAutoAdvance(e.target.checked)} />
            Giải đúng thì tự sang bài tiếp
          </label>
        </section>
        <section className="card training-panel training-help" aria-label="Hướng dẫn">
          <h2 className="training-panel__title">Premove</h2>
          <p>Trong lúc đối phương đi, kéo hoặc bấm quân để xếp sẵn nhiều nước (ô tô đỏ). Tới lượt bạn, nước đầu tiên được đi ngay, không mất giờ.</p>
          <p>
            Premove không hợp lệ thì cả hàng bị hủy. Chuột phải hoặc <kbd>Esc</kbd> để hủy premove.
          </p>
          <p>
            Không có premove thì chuột phải vào ô để đánh dấu, kéo chuột phải để vẽ mũi tên. Bấm chuột trái để xóa.
          </p>
        </section>
      </aside>

      <section className="layout__center" aria-label="Bàn cờ luyện tập">
        <div className="training-top">
          <div className="training-top__text">
            <strong>{session ? goalText(session) : 'Đang tải bài tập…'}</strong>
            <span>
              {analysis
                ? `Phân tích tự do · ${sideName(analysis.fen.split(' ')[1] === 'b' ? 'b' : 'w')} đi`
                : solution
                  ? 'Đáp án'
                  : session
                    ? turnText(session)
                    : ''}
            </span>
          </div>
          <div
            className={[
              'training-clock',
              clockRunning ? 'training-clock--running' : '',
              clockMs < 10_000 ? 'training-clock--low' : '',
            ].join(' ')}
            role="timer"
            aria-label="Thời gian còn lại"
          >
            {formatCountdown(clockMs)}
          </div>
        </div>
        {evalVisible && <AssessmentBar score={currentEval?.score ?? null} />}
        <div className="board-frame">
          {session && analysis ? (
            <Board
              id="analysis-board"
              fen={analysis.fen}
              lastMove={analysis.lastMove}
              lastMoveClass={currentReview?.class ?? null}
              orientation={session.player === 'w' ? 'white' : 'black'}
              onMove={t.analysisMove}
            />
          ) : session ? (
            <TrainingBoard
              key={t.attempt}
              fen={solution?.fen ?? session.fen}
              displayFen={solution?.fen ?? displayFen(session)}
              player={session.player}
              lastMove={solution?.lastMove ?? session.lastMove}
              lastMoveClass={solution ? null : (currentReview?.class ?? null)}
              premoves={solution ? [] : session.premoves}
              canMove={!solution && isPlayerTurn(session)}
              canPremove={!solution && isOpponentTurn(session)}
              onMove={t.move}
              onPremove={t.premove}
              onClearPremoves={t.clearPremoves}
            />
          ) : (
            <div className="board training-board--empty">{t.error ?? 'Đang tải…'}</div>
          )}
        </div>
        {feedback && (
          <p className="analysis-feedback">
            <MoveBadge cls={feedback.cls} />
            <strong>{feedback.played}</strong> là nước <strong style={{ color: MOVE_CLASS_META[feedback.cls].color }}>{MOVE_CLASS_META[feedback.cls].label.toLowerCase()}</strong>
            {feedback.best && (
              <>
                {' · '}Nước tốt nhất: <strong>{feedback.best}</strong>
              </>
            )}
          </p>
        )}
        {analysis && (
          <div className="analysis-nav">
            <div className="analysis-nav__buttons">
              <button type="button" onClick={() => t.analysisStep(-999)} disabled={analysis.cursor === 0} aria-label="Về đầu">
                ⏮
              </button>
              <button type="button" onClick={() => t.analysisStep(-1)} disabled={analysis.cursor === 0} aria-label="Lùi">
                ◀
              </button>
              <button type="button" onClick={() => t.analysisStep(1)} disabled={analysis.cursor === analysis.sans.length} aria-label="Tới">
                ▶
              </button>
              <button type="button" onClick={() => t.analysisStep(999)} disabled={analysis.cursor === analysis.sans.length} aria-label="Về cuối">
                ⏭
              </button>
            </div>
            <ol className="analysis-nav__moves">
              {analysis.sans.map((san, i) => (
                <li key={i} className={i === analysis.cursor - 1 ? 'analysis-nav__move analysis-nav__move--active' : 'analysis-nav__move'}>
                  {lineReview.reviews[i] && <MoveBadge cls={lineReview.reviews[i]!.class} />}
                  {san}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <aside className="layout__right card training-side" aria-label="Kết quả">
        <section className="training-result-wrap" aria-live="polite">
          {result ? (
            <div className={`training-result ${result.tone}`}>
              <strong>{result.title}</strong>
              {session?.reason && session.status !== 'timeout' && <span>{session.reason}</span>}
              {session?.status === 'solved' && session.task.kind === 'puzzle' && t.autoAdvance && !analysis && (
                <span>Đang sang bài tiếp…</span>
              )}
            </div>
          ) : (
            <div className="training-result">
              <strong>{session?.task.kind === 'puzzle' ? `Puzzle #${session.task.puzzle.id}` : 'Chiếu hết cơ bản'}</strong>
              <span>
                {session?.task.kind === 'puzzle'
                  ? `Độ khó ${session.task.puzzle.rating}`
                  : 'Stockfish phòng thủ. Hòa pat, mất quân, lặp 3 lần hay luật 50 nước đều tính là chưa đạt.'}
              </span>
            </div>
          )}
          <div className="training-actions">
            <button type="button" className="training-actions__primary" onClick={t.next} disabled={t.loading}>
              Bài tiếp
            </button>
            <button type="button" onClick={t.retry} disabled={!session}>
              Thử lại
            </button>
            {session?.task.kind === 'puzzle' && (
              <button type="button" onClick={t.showSolution} disabled={solution !== null}>
                Xem đáp án
              </button>
            )}
            {session && (
              <button
                type="button"
                onClick={analysis ? t.exitAnalysis : t.startAnalysis}
                title={session.status === 'playing' ? 'Mở phân tích giữa chừng: bài này tính là chưa giải được' : undefined}
              >
                {analysis ? 'Thoát phân tích' : 'Phân tích'}
              </button>
            )}
          </div>
        </section>
        {t.history.length > 0 && (
          <section className="training-history" aria-label="Bài đã làm">
            <h2 className="training-panel__title">Bài đã làm</h2>
            <ol>
              {t.history.map((h) => (
                <li key={h.attempt}>
                  <button
                    type="button"
                    className={h.task === session?.task ? 'training-history__item training-history__item--current' : 'training-history__item'}
                    onClick={() => t.open(h.task)}
                    title="Làm lại bài này"
                  >
                    <span className={`training-history__mark training-history__mark--${h.status}`} aria-label={HISTORY_MARK[h.status].label}>
                      {HISTORY_MARK[h.status].icon}
                    </span>
                    <span className="training-history__name">{historyName(h.task)}</span>
                    <span className="training-history__meta">{historyMeta(h.task)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}
        <section className="training-stats" aria-label="Thống kê">
          <h2 className="training-panel__title">Thống kê</h2>
          <dl>
            <div>
              <dt>Đúng / lượt làm</dt>
              <dd title="Số lượt giải đúng / tổng số lượt làm bài (tính cả Thử lại và chiếu hết cơ bản)">
                {t.stats.solved}/{t.stats.attempted}
              </dd>
            </div>
            <div>
              <dt>Chuỗi đúng</dt>
              <dd>{t.stats.streak}</dd>
            </div>
            <div>
              <dt>Chuỗi dài nhất</dt>
              <dd>{t.stats.bestStreak}</dd>
            </div>
          </dl>
          <button type="button" className="training-stats__reset" onClick={t.resetStats}>
            Xóa thống kê
          </button>
        </section>
        <p className="training-credit">
          Puzzle: <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer">kho puzzle lichess</a> (CC0).
        </p>
      </aside>
    </>
  )
}
