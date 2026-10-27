import { negateScore } from '../analysis/perspective'
import type { Score } from '../types'

export interface EngineInfo {
  depth: number
  seldepth?: number
  multipv: number
  score: Score
  /** Score chỉ là cận trên/dưới (aspiration window), chưa chính xác. */
  bound?: 'lower' | 'upper'
  nodes?: number
  nps?: number
  pv: string[]
}

/** Parse một dòng `info ...` có score. Trả null với các dòng khác (info string, currmove...). */
export function parseInfo(line: string): EngineInfo | null {
  const t = line.trim().split(/\s+/)
  if (t[0] !== 'info') return null

  let depth: number | undefined
  let score: Score | undefined
  const info: Partial<EngineInfo> = { multipv: 1, pv: [] }

  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'string':
        return null
      case 'depth':
        depth = Number(t[++i])
        break
      case 'seldepth':
        info.seldepth = Number(t[++i])
        break
      case 'multipv':
        info.multipv = Number(t[++i])
        break
      case 'nodes':
        info.nodes = Number(t[++i])
        break
      case 'nps':
        info.nps = Number(t[++i])
        break
      case 'score': {
        const kind = t[++i]
        const value = Number(t[++i])
        if (Number.isNaN(value)) return null
        if (kind === 'cp') score = { kind: 'cp', value }
        else if (kind === 'mate') score = { kind: 'mate', value }
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') {
          info.bound = t[++i] === 'lowerbound' ? 'lower' : 'upper'
        }
        break
      }
      case 'pv':
        info.pv = t.slice(i + 1)
        i = t.length
        break
    }
  }

  if (depth === undefined || score === undefined || Number.isNaN(depth)) return null
  return { ...info, depth, score } as EngineInfo
}

/** `bestmove e2e4 ponder e7e5` → "e2e4"; `bestmove (none)` → null. */
export function parseBestMove(line: string): string | null | undefined {
  const t = line.trim().split(/\s+/)
  if (t[0] !== 'bestmove') return undefined
  return !t[1] || t[1] === '(none)' ? null : t[1]
}

export function sideToMove(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w'
}

/**
 * Stockfish báo score theo góc nhìn bên đang tới lượt. Đổi về góc nhìn Trắng.
 * `mate 0` nghĩa là bên tới lượt đã bị chiếu hết.
 */
export function toWhitePov(score: Score, fen: string): Score {
  const sideScore: Score =
    score.kind === 'mate' && score.value === 0 ? { kind: 'gameover', outcome: 'loss' } : score
  return sideToMove(fen) === 'w' ? sideScore : negateScore(sideScore)
}
