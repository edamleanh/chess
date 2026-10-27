import { useEffect, useMemo, useRef, useState } from 'react'
import { classifyMove, type MoveClass, type MoveReview } from '../analysis/classifyMove'
import { BATCH_MULTI_PV, QUALITIES } from '../analysis/quality'
import type { Variation } from '../chess/exploration'
import { terminalScore } from '../chess/terminal'
import { browserEnv } from '../engine/engineManager'
import { EnginePool } from '../engine/enginePool'
import type { EnginePosition, SearchResult } from '../engine/StockfishEngine'
import type { GameModel, PositionEval } from '../types'

/** Biến phụ chạy cùng lúc với phân tích live, nên dùng pool nhỏ. */
const VARIATION_ENGINES = 2
const LIMITS = {
  movetimeMs: QUALITIES.standard.movetimeMs,
  maxDepth: QUALITIES.standard.maxDepth,
  multiPv: BATCH_MULTI_PV,
}

/** Eval đã có của các vị trí biến phụ, theo lịch sử nước từ đầu ván (dùng lại khi quay lại biến cũ). */
const cache = new Map<string, PositionEval>()

const keyOf = (p: EnginePosition) => `${p.startFen}|${(p.moves ?? []).join(' ')}`

export interface VariationReview {
  /** evals[c]: eval của vị trí sau c nước của biến phụ (c = 0 là điểm rẽ nhánh). */
  evals: (PositionEval | null)[]
  /** reviews[i]: đánh giá nước thứ i của biến phụ; null khi chưa đủ eval. */
  reviews: (MoveReview | null)[]
}

const EMPTY: VariationReview = { evals: [], reviews: [] }

/**
 * Chấm các nước người dùng tự đi trong biến phụ, cùng cách với ván chính (classifyMove).
 * Eval điểm rẽ nhánh lấy từ phân tích cả ván nếu đã có; các vị trí còn lại được phân tích bằng pool nhỏ.
 */
export function useVariationReview(
  game: GameModel,
  variation: Variation | null,
  mainEvals: (PositionEval | null)[],
): VariationReview {
  const [version, setVersion] = useState(0)
  const poolRef = useRef<EnginePool | null>(null)
  const inFlight = useRef(new Set<string>())

  // Các vị trí của biến phụ: điểm rẽ nhánh + sau mỗi nước
  const positions = useMemo((): EnginePosition[] => {
    if (!variation) return []
    const base = game.plies.slice(0, variation.fromPly).map((p) => p.uci)
    const baseFen = variation.fromPly === 0 ? game.startFen : game.plies[variation.fromPly - 1].fenAfter
    return [
      { fen: baseFen, startFen: game.startFen, moves: base },
      ...variation.moves.map((m, i) => ({
        fen: m.fenAfter,
        startFen: game.startFen,
        moves: [...base, ...variation.moves.slice(0, i + 1).map((v) => v.uci)],
      })),
    ]
  }, [game, variation])

  const hasVariation = variation !== null
  // Rời biến phụ (hoặc rời màn review): giải phóng pool
  useEffect(() => {
    if (!hasVariation) return
    const flight = inFlight.current
    return () => {
      poolRef.current?.terminate()
      poolRef.current = null
      flight.clear()
    }
  }, [hasVariation])

  useEffect(() => {
    if (!variation) return
    positions.forEach((position, c) => {
      const key = keyOf(position)
      if (c === 0 && mainEvals[variation.fromPly]) return // đã có từ phân tích cả ván
      if (cache.has(key) || inFlight.current.has(key)) return
      const terminal = terminalScore(position)
      if (terminal) {
        cache.set(key, { score: terminal, bestMove: null, lines: [], depth: null })
        return
      }
      poolRef.current ??= new EnginePool(browserEnv(), 'full-single', undefined, VARIATION_ENGINES)
      const pool = poolRef.current
      inFlight.current.add(key)
      void pool.analyze(position, LIMITS).then((result) => {
        inFlight.current.delete(key)
        const evaluation = toPositionEval(result)
        if (!evaluation) return
        cache.set(key, evaluation)
        if (poolRef.current === pool) setVersion((v) => v + 1)
      })
    })
  }, [variation, positions, mainEvals])

  return useMemo(() => {
    if (!variation) return EMPTY
    const evals = positions.map((p, c) => (c === 0 && mainEvals[variation.fromPly]) || cache.get(keyOf(p)) || null)
    const reviews: (MoveReview | null)[] = []
    let previousClass: MoveClass | undefined = undefined
    variation.moves.forEach((ply, i) => {
      const before = evals[i]
      const after = evals[i + 1]
      const previous = i === 0 ? game.plies[variation.fromPly - 1] : variation.moves[i - 1]
      const review = before && after ? classifyMove(ply, before, after, { previous, previousClass }) : null
      previousClass = review?.class
      reviews.push(review)
    })
    return { evals, reviews }
    // `version` đổi khi cache có thêm eval
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, variation, positions, mainEvals, version])
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
