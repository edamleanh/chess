import { Chess } from 'chess.js'
import type { Color } from '../types'

/**
 * Bài puzzle chiếu hết (dữ liệu lichess, CC0). `fen` là thế cờ TRƯỚC nước của đối phương;
 * `moves[0]` là nước đối phương vừa đi, sau đó xen kẽ: nước người giải, nước đối phương...
 */
export interface Puzzle {
  id: string
  fen: string
  moves: string[]
  rating: number
  /** Chiếu hết sau bao nhiêu nước của người giải. */
  mateIn: number
}

/** Dạng gọn trong puzzles.json: [id, fen, "uci uci ...", rating, mateIn]. */
export type PuzzleRow = [string, string, string, number, number]

export function fromRow([id, fen, moves, rating, mateIn]: PuzzleRow): Puzzle {
  return { id, fen, moves: moves.split(' '), rating, mateIn }
}

export interface PuzzleState {
  puzzle: Puzzle
  /** Thế cờ hiện tại. */
  fen: string
  /** Chỉ số trong `puzzle.moves` của nước tiếp theo cần đi. */
  step: number
  solver: Color
  /** Các nước đã đi (UCI), kể cả nước mở đầu của đối phương. */
  played: string[]
}

export type MoveResult =
  /** Đúng, chưa xong: chờ đối phương trả lời (`opponentReply`). */
  | { kind: 'correct'; state: PuzzleState }
  /** Đúng và đã chiếu hết. */
  | { kind: 'solved'; state: PuzzleState }
  /** Hợp lệ nhưng sai đáp án. */
  | { kind: 'wrong'; state: PuzzleState }
  /** Nước không hợp lệ (bàn cờ trả quân về chỗ cũ). */
  | { kind: 'illegal' }

function apply(fen: string, uci: string): { fen: string; checkmate: boolean } | null {
  const chess = new Chess(fen)
  try {
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return null
  }
  return { fen: chess.fen(), checkmate: chess.isCheckmate() }
}

/** Bắt đầu bài: đi nước mở đầu của đối phương; người giải là bên tới lượt sau đó. */
export function startPuzzle(puzzle: Puzzle): PuzzleState {
  const first = apply(puzzle.fen, puzzle.moves[0])
  if (!first) throw new Error(`Puzzle ${puzzle.id}: nước mở đầu không hợp lệ`)
  const solver = first.fen.split(' ')[1] === 'b' ? 'b' : 'w'
  return { puzzle, fen: first.fen, step: 1, solver, played: [puzzle.moves[0]] }
}

/**
 * Chấm nước của người giải. Như lichess: nước nào chiếu hết cũng được tính đúng (kể cả khác đáp án);
 * các nước khác phải trùng đáp án.
 */
export function checkMove(state: PuzzleState, uci: string): MoveResult {
  const result = apply(state.fen, uci)
  if (!result) return { kind: 'illegal' }
  const next: PuzzleState = { ...state, fen: result.fen, step: state.step + 1, played: [...state.played, uci] }
  if (result.checkmate) return { kind: 'solved', state: next }
  if (uci !== state.puzzle.moves[state.step]) return { kind: 'wrong', state: next }
  return { kind: 'correct', state: next }
}

/** Nước trả lời của đối phương (theo đáp án); null nếu đã hết đáp án. */
export function opponentReply(state: PuzzleState): { uci: string; state: PuzzleState } | null {
  const uci = state.puzzle.moves[state.step]
  if (!uci) return null
  const result = apply(state.fen, uci)
  if (!result) return null
  return { uci, state: { ...state, fen: result.fen, step: state.step + 1, played: [...state.played, uci] } }
}

/** Các nước đáp án còn lại kể từ thế cờ hiện tại của bài (để "Xem đáp án"). */
export function remainingSolution(state: PuzzleState): string[] {
  return state.puzzle.moves.slice(state.step)
}
