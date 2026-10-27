import { Chess } from 'chess.js'
import type { Color } from '../types'
import { endgameResult, type EndgameKind } from './endgames'
import { premoveTargets, takePremove, virtualFen, type Premove } from './premove'
import { checkMove, type Puzzle, type PuzzleState } from './puzzle'
import { newClock, pauseClock, remaining, startClock, type Clock } from './timer'

export type Task = { kind: 'puzzle'; puzzle: Puzzle } | { kind: 'endgame'; endgame: EndgameKind; fen: string }

export type Status = 'playing' | 'solved' | 'failed' | 'timeout'

export interface LastMove {
  from: string
  to: string
  san: string
}

/**
 * Một lần làm bài. Đối phương: puzzle đi theo đáp án, chiếu hết cơ bản do Stockfish đi (hook lo phần gọi engine).
 * Đồng hồ chỉ chạy trong lượt người chơi; premove xếp trong lượt đối phương và tự đi ngay khi tới lượt.
 */
export interface Session {
  task: Task
  startFen: string
  /** Mọi nước đã đi từ `startFen` (UCI), kể cả nước mở đầu của đối phương trong puzzle. */
  moves: string[]
  fen: string
  player: Color
  status: Status
  /** Lý do thua bài (để hiện cho người chơi). */
  reason: string | null
  clock: Clock
  premoves: Premove[]
  lastMove: LastMove | null
}

const turnOf = (fen: string): Color => (fen.split(' ')[1] === 'b' ? 'b' : 'w')
const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w')

/** Bắt đầu bài; bài bắt đầu ở lượt người chơi (chiếu hết cơ bản) thì đồng hồ chạy ngay từ `now`. */
export function startSession(task: Task, limitMs: number, now: number): Session {
  const startFen = task.kind === 'puzzle' ? task.puzzle.fen : task.fen
  // Puzzle: FEN là thế cờ trước nước mở đầu của đối phương; người giải là bên còn lại
  const player = task.kind === 'puzzle' ? opposite(turnOf(startFen)) : 'w'
  return {
    task,
    startFen,
    moves: [],
    fen: startFen,
    player,
    status: 'playing',
    reason: null,
    clock: turnOf(startFen) === player ? startClock(newClock(limitMs), now) : newClock(limitMs),
    premoves: [],
    lastMove: null,
  }
}

export const isPlayerTurn = (s: Session) => s.status === 'playing' && turnOf(s.fen) === s.player

/** Đang chờ đối phương đi. */
export const isOpponentTurn = (s: Session) => s.status === 'playing' && turnOf(s.fen) !== s.player

/** Nước đáp án tiếp theo của đối phương trong puzzle (null với chiếu hết cơ bản). */
export function puzzleOpponentMove(s: Session): string | null {
  return s.task.kind === 'puzzle' ? (s.task.puzzle.moves[s.moves.length] ?? null) : null
}

function puzzleState(s: Session, puzzle: Puzzle): PuzzleState {
  return { puzzle, fen: s.fen, step: s.moves.length, solver: s.player, played: s.moves }
}

function apply(s: Session, uci: string): Session | null {
  const chess = new Chess(s.fen)
  try {
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return { ...s, fen: chess.fen(), moves: [...s.moves, uci], lastMove: { from: m.from, to: m.to, san: m.san } }
  } catch {
    return null
  }
}

function finish(s: Session, status: Status, reason: string | null, now: number): Session {
  return { ...s, status, reason, clock: pauseClock(s.clock, now), premoves: [] }
}

/** Người chơi đi một nước trong lượt mình. null nếu không hợp lệ (bàn cờ trả quân về). */
export function playerMove(s: Session, uci: string, now: number): Session | null {
  if (tick(s, now) !== s) return null // đã hết giờ (tick 100 ms chưa kịp báo)
  if (!isPlayerTurn(s)) return null
  const task = s.task
  if (task.kind === 'puzzle') {
    const result = checkMove(puzzleState(s, task.puzzle), uci)
    if (result.kind === 'illegal') return null
    const next = apply(s, uci)!
    if (result.kind === 'solved') return finish(next, 'solved', null, now)
    if (result.kind === 'wrong') return finish(next, 'failed', 'Chưa phải nước đúng', now)
    return { ...next, clock: pauseClock(next.clock, now) }
  }
  const next = apply(s, uci)
  if (!next) return null
  const result = endgameResult(next.startFen, next.moves)
  if (result === 'win') return finish(next, 'solved', null, now)
  if (result === 'draw') return finish(next, 'failed', drawReason(next), now)
  return { ...next, clock: pauseClock(next.clock, now) }
}

function drawReason(s: Session): string {
  const chess = new Chess(s.fen)
  if (chess.isStalemate()) return 'Hòa pat'
  if (chess.isInsufficientMaterial()) return 'Mất quân, không đủ quân chiếu hết'
  if (chess.isDrawByFiftyMoves()) return 'Hòa theo luật 50 nước'
  return 'Hòa do lặp lại thế cờ'
}

/**
 * Đối phương đi `uci`. Tới lượt người chơi thì đồng hồ chạy, rồi premove đầu hàng đợi (nếu có) được đi ngay;
 * premove không hợp lệ thì hủy cả hàng đợi.
 */
export function opponentMove(s: Session, uci: string, now: number): Session {
  if (!isOpponentTurn(s)) return s
  const next = apply(s, uci)
  if (!next) return s
  if (s.task.kind === 'endgame' && endgameResult(next.startFen, next.moves) === 'draw') {
    return finish(next, 'failed', drawReason(next), now)
  }
  const running = { ...next, clock: startClock(next.clock, now) }
  if (running.premoves.length === 0) return running
  const { uci: premove, rest } = takePremove(running.fen, running.premoves)
  if (!premove) return { ...running, premoves: [] }
  const played = playerMove({ ...running, premoves: rest }, premove, now)
  return played ?? { ...running, premoves: [] }
}

/** Thế cờ hiển thị trong lượt đối phương: quân của người chơi đứng ở vị trí sau các premove. */
export function displayFen(s: Session): string {
  return s.premoves.length ? virtualFen(s.fen, s.premoves, s.player) : s.fen
}

/** Thêm premove (chỉ trong lượt đối phương, theo cách quân đi trên bàn ảo). */
export function addPremove(s: Session, premove: Premove): Session | null {
  if (!isOpponentTurn(s)) return null
  if (!premoveTargets(displayFen(s), premove.from).includes(premove.to)) return null
  return { ...s, premoves: [...s.premoves, premove] }
}

export const clearPremoves = (s: Session): Session => (s.premoves.length ? { ...s, premoves: [] } : s)

/** Bỏ cuộc (xem đáp án, mở phân tích giữa chừng): tính là chưa giải được, như lichess. */
export function giveUp(s: Session, now: number, reason = 'Đã xem đáp án'): Session {
  return s.status === 'playing' ? finish(s, 'failed', reason, now) : s
}

/** Rời màn luyện tập: dừng đồng hồ. */
export const pauseSession = (s: Session, now: number): Session =>
  s.clock.runningSince === null ? s : { ...s, clock: pauseClock(s.clock, now) }

/** Quay lại: đồng hồ chạy tiếp nếu đang tới lượt người chơi. */
export const resumeSession = (s: Session, now: number): Session =>
  isPlayerTurn(s) && s.clock.runningSince === null ? { ...s, clock: startClock(s.clock, now) } : s

/** Kiểm tra hết giờ. */
export function tick(s: Session, now: number): Session {
  if (s.status !== 'playing' || remaining(s.clock, now) > 0) return s
  return finish(s, 'timeout', 'Hết giờ', now)
}

/** Các thế cờ của đáp án puzzle, từ sau nước mở đầu của đối phương tới chiếu hết. */
export function solutionFens(puzzle: Puzzle): { fen: string; lastMove: LastMove }[] {
  const chess = new Chess(puzzle.fen)
  return puzzle.moves.map((uci) => {
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return { fen: chess.fen(), lastMove: { from: m.from, to: m.to, san: m.san } }
  })
}
