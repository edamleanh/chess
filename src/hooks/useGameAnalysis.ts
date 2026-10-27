import { useEffect, useMemo, useState } from 'react'
import { BATCH_MULTI_PV, QUALITIES, type QualityId } from '../analysis/quality'
import { reviewGame } from '../analysis/reviewGame'
import { positionAt } from '../chess/navigation'
import { terminalScore } from '../chess/terminal'
import { browserEnv, getEngineManager } from '../engine/engineManager'
import { EnginePool, type PoolStatus } from '../engine/enginePool'
import type { SearchResult } from '../engine/StockfishEngine'
import type { GameModel, PositionEval } from '../types'

export type GameAnalysisStatus = 'running' | 'done' | 'error'

/** Thử lại một vị trí khi engine trả bestmove mà chưa kịp báo score (hiếm). */
const POSITION_ATTEMPTS = 2

interface State {
  game: GameModel
  quality: QualityId
  evals: (PositionEval | null)[]
  status: GameAnalysisStatus
  pool: PoolStatus | null
}

/**
 * Phân tích mọi vị trí của ván bằng một pool engine chạy song song (EnginePool), rồi chấm từng nước.
 * Trong lúc chạy, phân tích live bị tạm dừng để nhường CPU. Kết quả cập nhật dần theo thứ tự hoàn thành;
 * đổi ván hoặc đổi chất lượng thì hủy pool cũ và phân tích lại từ đầu.
 */
export function useGameAnalysis(game: GameModel, quality: QualityId, bookPlies = 0) {
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    const { movetimeMs, maxDepth, engine } = QUALITIES[quality]
    const limits = { movetimeMs, maxDepth, multiPv: BATCH_MULTI_PV }
    const evals: (PositionEval | null)[] = Array(game.plies.length + 1).fill(null)
    let status: GameAnalysisStatus = 'running'
    let poolStatus: PoolStatus | null = null
    let active = true
    const publish = () => {
      if (active) setState({ game, quality, evals: [...evals], status, pool: poolStatus })
    }

    const releaseLive = getEngineManager().holdLive()
    const pool = new EnginePool(browserEnv(), engine, (s) => {
      poolStatus = s
      publish()
    })

    const analyzePosition = async (i: number): Promise<boolean> => {
      const position = positionAt(game, i)
      const terminal = terminalScore(position)
      if (terminal) {
        evals[i] = { score: terminal, bestMove: null, lines: [], depth: null }
      } else {
        for (let attempt = 0; attempt < POSITION_ATTEMPTS && !evals[i]; attempt++) {
          const result = await pool.analyze(position, limits)
          if (result.cancelled) return false // pool bị hủy hoặc không còn engine nào chạy được
          evals[i] = toPositionEval(result)
        }
        if (!evals[i]) return false
      }
      publish()
      return true
    }

    void Promise.all(evals.map((_, i) => analyzePosition(i))).then((ok) => {
      if (!active) return
      status = ok.every(Boolean) ? 'done' : 'error'
      publish()
      pool.terminate() // giải phóng RAM (mỗi engine Full ~170 MB)
      releaseLive()
    })

    return () => {
      active = false
      pool.terminate()
      releaseLive()
    }
  }, [game, quality])

  const current = state?.game === game && state.quality === quality ? state : null
  const evals = useMemo(() => current?.evals ?? Array(game.plies.length + 1).fill(null), [current, game])
  const review = useMemo(() => reviewGame(game, evals, bookPlies), [game, evals, bookPlies])

  return {
    status: current?.status ?? 'running',
    evals,
    review,
    pool: current?.pool ?? null,
    analyzed: evals.filter((e) => e !== null).length,
    total: evals.length,
  }
}

function toPositionEval(result: SearchResult): PositionEval | null {
  if (!result.lastInfo) return null // engine trả bestmove mà chưa kịp báo score
  return {
    score: result.lastInfo.score,
    bestMove: result.bestMove,
    lines: result.lines.map((l) => ({ score: l.score, pv: l.pv })),
    depth: result.lastInfo.depth,
  }
}
