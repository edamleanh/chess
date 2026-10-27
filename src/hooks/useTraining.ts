import { Chess } from 'chess.js'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { browserEnv } from '../engine/engineManager'
import { EnginePool } from '../engine/enginePool'
import { moveSoundKind } from '../sound/moveSound'
import { playMoveSound } from '../sound/player'
import { DEFAULT_OPPONENT_DELAY, pickTask, puzzlesFor, isEndgame, type ExerciseId } from '../training/exercises'
import type { Premove } from '../training/premove'
import { explorePlay, explorePosition, exploreSans, exploreStep, startExplore, type Explore } from '../training/explore'
import { fromRow, type Puzzle, type PuzzleRow } from '../training/puzzle'
import {
  addPremove,
  clearPremoves,
  isOpponentTurn,
  opponentMove,
  giveUp,
  pauseSession,
  playerMove,
  resumeSession,
  puzzleOpponentMove,
  solutionFens,
  startSession,
  tick,
  type LastMove,
  type Session,
  type Task,
} from '../training/session'
import { EMPTY_STATS, parseStats, recordResult, type TrainingStats } from '../training/stats'

/** Engine phòng thủ (chiếu hết cơ bản): Lite 1 luồng, nhẹ, đủ mạnh cho Vua đơn. */
const DEFENCE_LIMITS = { movetimeMs: 300, maxDepth: 12 }
/** Puzzle đúng thì tự sang bài kế. */
const AUTO_NEXT_MS = 1200
const SOLUTION_STEP_MS = 800
/** Nước mở đầu của đối phương khi hiện đề puzzle. */
const OPENING_MOVE_MS = 500
const STATS_KEY = 'chess-review:training'
/** Các puzzle đã gặp (để không ra trùng bài), lưu trong trình duyệt. */
const SEEN_KEY = 'chess-review:training-seen'

function readSeen(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    // không lưu được: chỉ tránh trùng trong phiên này
  }
}

let puzzleCache: Promise<Puzzle[]> | null = null
function loadPuzzles(): Promise<Puzzle[]> {
  puzzleCache ??= import('../training/puzzles.json').then((m) => (m.default as PuzzleRow[]).map(fromRow))
  puzzleCache.catch(() => (puzzleCache = null))
  return puzzleCache
}

function readStats(): TrainingStats {
  try {
    return parseStats(localStorage.getItem(STATS_KEY))
  } catch {
    return EMPTY_STATS
  }
}

function saveStats(stats: TrainingStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    // không lưu được: chỉ giữ trong phiên này
  }
}

function randomLegalMove(fen: string): string | null {
  const moves = new Chess(fen).moves({ verbose: true })
  const m = moves[Math.floor(Math.random() * moves.length)]
  return m ? m.lan : null
}

export interface SolutionView {
  fen: string
  lastMove: LastMove
}

/** Một bài đã làm trong phiên (mới nhất trước). */
export interface HistoryEntry {
  attempt: number
  task: Task
  status: Exclude<Session['status'], 'playing'>
}

const HISTORY_SIZE = 30

/** Bàn phân tích sau khi làm xong bài: tự đi quân cho cả hai bên. */
export interface Analysis {
  startFen: string
  /** Toàn bộ nước của bàn phân tích (UCI), kể cả phần sau con trỏ. */
  moves: string[]
  fen: string
  lastMove: LastMove | null
  sans: string[]
  cursor: number
}

export interface Training {
  exercise: ExerciseId
  setExercise: (id: ExerciseId) => void
  limitSec: number
  setLimitSec: (sec: number) => void
  opponentDelay: number
  setOpponentDelay: (ms: number) => void
  session: Session | null
  /** Lần làm bài hiện tại (đổi khi bắt đầu bài mới hoặc làm lại). */
  attempt: number
  loading: boolean
  error: string | null
  now: number
  stats: TrainingStats
  history: HistoryEntry[]
  /** Mở lại một bài đã làm (làm lại từ đầu). */
  open: (task: Task) => void
  solution: SolutionView | null
  /** Puzzle giải đúng thì tự sang bài kế. */
  /** Đổi mỗi khi có thêm puzzle đã gặp (để tính lại tiến độ). */
  seenVersion: number
  /** Số puzzle đã gặp / tổng số của loại bài đang chọn; null với chiếu hết cơ bản. */
  progress: () => { seen: number; total: number } | null
  autoAdvance: boolean
  setAutoAdvance: (on: boolean) => void
  analysis: Analysis | null
  startAnalysis: () => void
  analysisMove: (uci: string) => boolean
  analysisStep: (delta: number) => void
  exitAnalysis: () => void
  next: () => void
  retry: () => void
  showSolution: () => void
  move: (uci: string) => boolean
  premove: (p: Premove) => boolean
  clearPremoves: () => void
  resetStats: () => void
}

export function useTraining(active: boolean, soundEnabled: boolean): Training {
  const [exercise, setExerciseState] = useState<ExerciseId>('m2')
  const [limits, setLimits] = useState({ puzzle: 30, endgame: 120 })
  // Đối phương đi sau ít nhất chừng này ms (puzzle và cả Stockfish), để kịp xếp nhiều premove
  const [opponentDelay, setOpponentDelay] = useState<number>(DEFAULT_OPPONENT_DELAY)
  const delayRef = useRef(opponentDelay)
  useLayoutEffect(() => {
    delayRef.current = opponentDelay
  }, [opponentDelay])
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<{ session: Session; attempt: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [stats, setStats] = useState(readStats)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [explore, setExplore] = useState<{ attempt: number; explore: Explore } | null>(null)
  const [solution, setSolution] = useState<{ attempt: number; index: number } | null>(null)
  const poolRef = useRef<EnginePool | null>(null)
  // Bản mới nhất của phiên cho các callback và effect bất đồng bộ (layout effect: cập nhật trước mọi effect thường)
  const runRef = useRef(run)
  useLayoutEffect(() => {
    runRef.current = run
  }, [run])

  const session = run?.session ?? null
  const attempt = run?.attempt ?? 0
  const group = isEndgame(exercise) ? 'endgame' : 'puzzle'
  const limitSec = limits[group]

  /** Áp một thay đổi lên phiên hiện tại; trả false nếu nước/premove bị từ chối (bàn cờ trả quân về). */
  function update(change: (s: Session) => Session | null): boolean {
    const current = runRef.current
    if (!current || !change(current.session)) return false
    setRun((r) => {
      const changed = r && r.attempt === current.attempt ? change(r.session) : null
      return changed && r ? { ...r, session: changed } : r
    })
    return true
  }

  // Kho puzzle tải lười khi mở chế độ luyện tập
  useEffect(() => {
    if (!active || puzzles) return
    let cancelled = false
    loadPuzzles().then(
      (list) => !cancelled && setPuzzles(list),
      () => !cancelled && setError('Không tải được kho bài tập. Thử tải lại trang.'),
    )
    return () => {
      cancelled = true
    }
  }, [active, puzzles])

  const begin = useCallback(
    (task: Task) => {
      setSolution(null)
      setRun((prev) => ({ session: startSession(task, limitSec * 1000, Date.now()), attempt: (prev?.attempt ?? 0) + 1 }))
    },
    [limitSec],
  )

  // Puzzle đã gặp: chọn bài chưa gặp; gặp hết một mức thì bắt đầu vòng mới cho mức đó
  const seenRef = useRef<Set<string> | null>(null)
  const [seenVersion, setSeenVersion] = useState(0)
  const choose = useCallback(
    (id: ExerciseId): Task | null => {
      const seen = (seenRef.current ??= readSeen())
      const pool = puzzlesFor(id, puzzles ?? [])
      if (pool.length && pool.every((p) => seen.has(p.id))) pool.forEach((p) => seen.delete(p.id))
      const task = pickTask(id, puzzles ?? [], seen)
      if (task?.kind === 'puzzle') {
        seen.add(task.puzzle.id)
        saveSeen(seen)
        setSeenVersion((v) => v + 1)
      }
      return task
    },
    [puzzles],
  )

  const next = useCallback(() => {
    const task = choose(exercise)
    if (task) begin(task)
  }, [exercise, choose, begin])

  // Bài đầu tiên khi kho đã sẵn sàng
  const hasRun = run !== null
  useEffect(() => {
    if (!active || !puzzles || hasRun) return
    let cancelled = false
    queueMicrotask(() => !cancelled && next())
    return () => {
      cancelled = true
    }
  }, [active, puzzles, hasRun, next])

  function setExercise(id: ExerciseId) {
    setExerciseState(id)
    const task = choose(id)
    if (task) {
      const sec = limits[isEndgame(id) ? 'endgame' : 'puzzle']
      setSolution(null)
      setRun((prev) => ({ session: startSession(task, sec * 1000, Date.now()), attempt: (prev?.attempt ?? 0) + 1 }))
    }
  }

  function setLimitSec(sec: number) {
    setLimits((l) => ({ ...l, [group]: sec }))
  }

  const retry = useCallback(() => {
    if (runRef.current) begin(runRef.current.session.task)
  }, [begin])

  // Lượt đối phương: puzzle đi theo đáp án, chiếu hết cơ bản hỏi Stockfish
  const opponentKey = session && isOpponentTurn(session) ? `${attempt}:${session.moves.length}` : null
  // Rời màn luyện tập: hủy lượt đang chờ (engine bị terminate), quay lại thì hỏi lại
  useEffect(() => {
    const current = runRef.current
    if (!active || !opponentKey || !current) return
    const { session: s, attempt: a } = current
    let cancelled = false
    const play = (uci: string | null) => {
      if (cancelled || !uci) return
      setRun((r) =>
        r && r.attempt === a && r.session.moves.length === s.moves.length
          ? { ...r, session: opponentMove(r.session, uci, Date.now()) }
          : r,
      )
    }
    if (s.task.kind === 'puzzle') {
      // Nước mở đầu của đề luôn đi nhanh; "Đối phương nghĩ" chỉ áp dụng cho các nước trả lời sau đó
      const delay = s.moves.length === 0 ? OPENING_MOVE_MS : delayRef.current
      const timer = setTimeout(() => play(puzzleOpponentMove(s)), delay)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }
    poolRef.current ??= new EnginePool(browserEnv(), 'lite-single', undefined, 1)
    const startedAt = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    void poolRef.current
      .analyze({ fen: s.fen, startFen: s.startFen, moves: s.moves }, DEFENCE_LIMITS)
      .then((result) => {
        if (cancelled) return
        const uci = result.bestMove ?? randomLegalMove(s.fen) // engine lỗi: vẫn đi được
        timer = setTimeout(() => play(uci), Math.max(0, delayRef.current - (Date.now() - startedAt)))
      })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [active, opponentKey])

  // Rời màn luyện tập: dừng đồng hồ (không bị xử hết giờ khi vắng mặt); quay lại thì chạy tiếp
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const t = Date.now()
      setNow(t)
      setRun((r) => (r ? { ...r, session: active ? resumeSession(r.session, t) : pauseSession(r.session, t) } : r))
    })
    return () => {
      cancelled = true
    }
  }, [active])

  // Giải phóng engine khi rời màn luyện tập
  useEffect(() => {
    if (active) return
    poolRef.current?.terminate()
    poolRef.current = null
  }, [active])
  useEffect(() => () => poolRef.current?.terminate(), [])

  // Đồng hồ: cập nhật hiển thị và kiểm tra hết giờ khi đang chạy
  const clockRunning = session?.status === 'playing' && session.clock.runningSince !== null
  useEffect(() => {
    if (!clockRunning) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setRun((r) => (r ? { ...r, session: tick(r.session, t) } : r))
    }, 100)
    return () => clearInterval(id)
  }, [clockRunning])

  // Ghi thống kê một lần cho mỗi lần làm bài
  const recorded = useRef(0)
  const status = session?.status
  useEffect(() => {
    const task = runRef.current?.session.task
    if (!status || status === 'playing' || !task || recorded.current === attempt) return
    recorded.current = attempt
    setHistory((h) => [{ attempt, task, status }, ...h].slice(0, HISTORY_SIZE))
    setStats((s) => {
      const updated = recordResult(s, status === 'solved')
      saveStats(updated)
      return updated
    })
  }, [status, attempt])

  // Puzzle đúng: tự sang bài kế
  const exploring = explore !== null && explore.attempt === attempt
  const autoNext = status === 'solved' && session?.task.kind === 'puzzle' && autoAdvance && !exploring
  useEffect(() => {
    if (!autoNext || !active) return
    const timer = setTimeout(next, AUTO_NEXT_MS)
    return () => clearTimeout(timer)
  }, [autoNext, active, next])

  // Bàn phân tích: tính thế cờ / danh sách nước từ trạng thái
  const current = exploring ? explore.explore : null
  const analysis = useMemo((): Analysis | null => {
    if (!current) return null
    return {
      ...explorePosition(current),
      startFen: current.startFen,
      moves: current.moves,
      sans: exploreSans(current),
      cursor: current.cursor,
    }
  }, [current])
  const changeExplore = (change: (e: Explore) => Explore | null): boolean => {
    if (!current) return false
    const next = change(current)
    if (!next) return false
    setExplore({ attempt, explore: next })
    return true
  }

  // Phân tích: ← → Home End để đi qua các nước
  useEffect(() => {
    if (!active || !exploring) return
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -999, End: 999 }
    const onKey = (e: KeyboardEvent) => {
      const delta = deltas[e.key]
      if (delta === undefined) return
      e.preventDefault()
      setExplore((x) => (x ? { ...x, explore: exploreStep(x.explore, delta) } : x))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, exploring])

  const analysisLast = analysis?.lastMove ?? null
  useEffect(() => {
    if (soundEnabled && analysisLast) playMoveSound(moveSoundKind(analysisLast.san))
  }, [analysisLast, soundEnabled])

  // Âm thanh nước đi
  const lastMove = session?.lastMove ?? null
  useEffect(() => {
    if (soundEnabled && lastMove) playMoveSound(moveSoundKind(lastMove.san))
  }, [lastMove, soundEnabled])

  // Esc: hủy premove
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRun((r) => (r ? { ...r, session: clearPremoves(r.session) } : r))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  // Xem đáp án: đi lại từng nước của đáp án puzzle
  const solutionLine = session?.task.kind === 'puzzle' && solution?.attempt === attempt ? solutionFens(session.task.puzzle) : null
  const solutionIndex = solution?.attempt === attempt ? solution.index : -1
  const solutionLength = solutionLine?.length ?? 0
  useEffect(() => {
    if (solutionIndex < 0 || solutionIndex >= solutionLength - 1) return
    const timer = setTimeout(
      () => setSolution((v) => (v && v.attempt === attempt ? { ...v, index: v.index + 1 } : v)),
      SOLUTION_STEP_MS,
    )
    return () => clearTimeout(timer)
  }, [solutionIndex, solutionLength, attempt])

  const solutionView = solutionLine && solutionIndex >= 0 ? solutionLine[solutionIndex] : null
  const solutionMove = solutionView?.lastMove ?? null
  useEffect(() => {
    if (soundEnabled && solutionMove) playMoveSound(moveSoundKind(solutionMove.san))
  }, [solutionMove, soundEnabled])

  return {
    seenVersion,
    progress: () => {
      const pool = puzzlesFor(exercise, puzzles ?? [])
      const seen = seenRef.current
      return pool.length && seen ? { seen: pool.filter((p) => seen.has(p.id)).length, total: pool.length } : null
    },
    autoAdvance,
    setAutoAdvance,
    analysis,
    startAnalysis: () => {
      if (!session) return
      // Đang làm bài thì dừng bài (tính là chưa giải được), rồi phân tích từ thế cờ hiện tại
      if (session.status === 'playing') {
        setRun((r) => (r && r.attempt === attempt ? { ...r, session: giveUp(r.session, Date.now(), 'Đã mở phân tích') } : r))
      }
      setSolution(null)
      setExplore({ attempt, explore: startExplore(session.startFen, session.moves) })
    },
    analysisMove: (uci) => changeExplore((e) => explorePlay(e, uci)),
    analysisStep: (delta) => void changeExplore((e) => exploreStep(e, delta)),
    exitAnalysis: () => setExplore(null),
    exercise,
    setExercise,
    limitSec,
    setLimitSec,
    opponentDelay,
    setOpponentDelay,
    session,
    attempt,
    loading: !puzzles && !error,
    error,
    now,
    stats,
    solution: solutionView,
    next,
    retry,
    history,
    open: begin,
    showSolution: () => {
      if (session?.task.kind !== 'puzzle') return
      // Đang làm thì bỏ cuộc (tính là chưa giải được) rồi mới xem đáp án
      setRun((r) => (r && r.attempt === attempt ? { ...r, session: giveUp(r.session, Date.now()) } : r))
      setExplore(null)
      setSolution({ attempt, index: 0 })
    },
    move: (uci) => update((s) => playerMove(s, uci, Date.now())),
    premove: (p) => update((s) => addPremove(s, p)),
    clearPremoves: () => setRun((r) => (r ? { ...r, session: clearPremoves(r.session) } : r)),
    resetStats: () => {
      saveStats(EMPTY_STATS)
      setStats(EMPTY_STATS)
    },
  }
}
