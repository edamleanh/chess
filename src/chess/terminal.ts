import { Chess } from 'chess.js'
import type { Score } from '../types'

export interface TerminalInput {
  fen: string
  /** Có lịch sử thì nhận ra được cả lặp 3 lần; không có thì chỉ dựa vào FEN. */
  startFen?: string
  moves?: string[]
}

/** Nếu ván đã kết thúc tại vị trí này theo luật, trả score theo góc nhìn Trắng. */
export function terminalScore(position: TerminalInput): Score | null {
  const chess = replay(position)
  if (chess.isCheckmate()) {
    return { kind: 'gameover', outcome: chess.turn() === 'w' ? 'loss' : 'win' }
  }
  // isDraw: hòa pat, không đủ quân, lặp 3 lần, luật 50 nước
  if (chess.isDraw()) return { kind: 'gameover', outcome: 'draw' }
  return null
}

function replay({ fen, startFen, moves }: TerminalInput): Chess {
  if (!startFen || !moves || moves.length === 0) return new Chess(fen)
  const chess = new Chess(startFen)
  try {
    for (const uci of moves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return new Chess(fen) // lịch sử không khớp: chỉ dựa vào FEN
  }
  return chess
}
