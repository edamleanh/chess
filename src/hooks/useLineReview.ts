import { useEffect, useMemo, useRef, useState } from 'react'
import { classifyMove, type MoveClass, type MoveReview } from '../analysis/classifyMove'
import { BATCH_MULTI_PV, QUALITIES } from '../analysis/quality'
import { makePly } from '../chess/exploration'
import { terminalScore } from '../chess/terminal'
import { browserEnv } from '../engine/engineManager'
import { EnginePool } from '../engine/enginePool'
import type { EnginePosition, SearchResult } from '../engine/StockfishEngine'
import type { PositionEval, Ply } from '../types'

/** Chạy song song với engine phòng thủ của bài chiếu hết cơ bản, nên dùng pool nhỏ. */
const LINE_ENGINES = 2
const LIMITS = {
  movetimeMs: QUALITIES.standard.movetimeMs,
  maxDepth: QUALITIES.standard.maxDepth,
  multiPv: BATCH_MULTI_PV,
}

/** Eval theo (thế cờ đầu, lịch sử nước): dùng lại khi đi lùi / tới hoặc mở lại bài. */
const cache = new Map<string, PositionEval>()
const keyOf = (p: EnginePosition) => `${p.startFen}|${(p.moves ?? []).join(' ')}`

export interface LineReview {
  /** evals[c]: eval (góc nhìn Trắng) của thế cờ sau c nước; null khi chưa có. */
  evals: (PositionEval | null)[]
  /** reviews[i]: nhãn nước thứ i (chấm như màn review); null khi chưa đủ eval. */
  reviews: (MoveReview | null)[]
}

const EMPTY: LineReview = { evals: [], reviews: [] }

/**
 * Chấm từng nước của một chuỗi nước đi từ `startFen` (bài luyện tập, bàn phân tích) bằng Stockfish,
 * cùng cách chấm với ván chính (classifyMove). `enabled = false` thì dừng và giải phóng engine.
 */
export function useLineReview(startFen: string | null, moves: string[], enabled: boolean): LineReview {
  const [version, setVersion] = useState(0)
  const poolRef = useRef<EnginePool | null>(null)
  const inFlight = useRef(new Set<string>())

  const positions = useMemo((): EnginePosition[] => {
    if (!startFen) return []
    const out: EnginePosition[] = [{ fen: startFen, startFen, moves: [] }]
    let fen = startFen
    for (let i = 0; i < moves.length; i++) {
      const ply = makePly(fen, moves[i], i)
      if (!ply) break
      fen = ply.fenAfter
      out.push({ fen, startFen, moves: moves.slice(0, i + 1) })
    }
    return out
  }, [startFen, moves])

  // Tắt (rời màn luyện tập): giải phóng pool
  useEffect(() => {
    if (!enabled) return
    const flight = inFlight.current
    return () => {
      poolRef.current?.terminate()
      poolRef.current = null
      flight.clear()
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    for (const position of positions) {
      const key = keyOf(position)
      if (cache.has(key) || inFlight.current.has(key)) continue
      const terminal = terminalScore(position)
      if (terminal) {
        cache.set(key, { score: terminal, bestMove: null, lines: [], depth: null })
        continue
      }
      poolRef.current ??= new EnginePool(browserEnv(), 'full-single', undefined, LINE_ENGINES)
      const pool = poolRef.current
      inFlight.current.add(key)
      void pool.analyze(position, LIMITS).then((result) => {
        inFlight.current.delete(key)
        const evaluation = toPositionEval(result)
        if (!evaluation) return
        cache.set(key, evaluation)
        if (poolRef.current === pool) setVersion((v) => v + 1)
      })
    }
    // Thế cờ kết thúc được thêm thẳng vào cache: cập nhật ngay
    queueMicrotask(() => setVersion((v) => v + 1))
  }, [enabled, positions])

  return useMemo(() => {
    if (positions.length === 0) return EMPTY
    const evals = positions.map((p) => cache.get(keyOf(p)) ?? null)
    const reviews: (MoveReview | null)[] = []
    let previous: Ply | undefined = undefined
    let previousClass: MoveClass | undefined = undefined
    for (let i = 0; i + 1 < positions.length; i++) {
      const ply = makePly(positions[i].fen, moves[i], i)
      const before = evals[i]
      const after = evals[i + 1]
      const review: MoveReview | null = ply && before && after ? classifyMove(ply, before, after, { previous, previousClass }) : null
      reviews.push(review)
      previous = ply ?? undefined
      previousClass = review?.class
    }
    return { evals, reviews }
    // `version` đổi khi cache có thêm eval
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, moves, version])
}

function toPositionEval(result: SearchResult): PositionEval | null {
  if (result.cancelled || !result.lastInfo) return null
  return {
    score: result.lastInfo.score,
    bestMove: result.bestMove,
    lines: result.lines.map((l) => ({ score: l.score, pv: l.pv })),
    depth: result.lastInfo.depth,
  }
}
