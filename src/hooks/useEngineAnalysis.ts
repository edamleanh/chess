import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { terminalScore } from '../chess/terminal'
import { getEngineManager } from '../engine/engineManager'
import type { EnginePosition } from '../engine/StockfishEngine'
import type { EngineInfo } from '../engine/uci'
import type { PositionEval, Score } from '../types'

/** Phân tích live: dừng sau 10 s hoặc depth 30, tùy điều kiện nào đến trước. */
const LIVE_LIMITS = { movetimeMs: 10_000, maxDepth: 30 }
const UI_THROTTLE_MS = 100

export interface LiveAnalysis {
  /** Score của vị trí hiện tại theo góc nhìn Trắng; null khi chưa có kết quả. */
  score: Score | null
  /** Score dùng cho eval bar: giữ score của vị trí trước trong lúc chờ, để thanh không giật về 50%. */
  barScore: Score | null
  depth: number | null
  bestMoveUci: string | null
  pv: string[]
  /** Vị trí đã kết thúc theo luật (chiếu hết, hòa pat, không đủ quân). */
  gameOver: boolean
}

/**
 * Phân tích live vị trí đang xem (ván chính hoặc biến phụ; `position` phải ổn định giữa các lần render).
 * Khi live chưa có kết quả (vd. đang bị hoãn vì phân tích cả ván) thì dùng `known`, là eval đã có của vị trí này.
 */
export function useEngineAnalysis(position: EnginePosition, enabled: boolean, known: PositionEval | null) {
  const manager = getEngineManager()
  const status = useSyncExternalStore(manager.subscribe, manager.getStatus)
  const terminal = useMemo(() => terminalScore(position), [position])
  const [latest, setLatest] = useState<{ fen: string; info: EngineInfo } | null>(null)

  // Rời màn review thì dừng engine, không để chạy nốt tới 10 s
  useEffect(() => () => manager.stop(), [manager])

  useEffect(() => {
    if (!enabled || terminal) {
      manager.stop()
      return
    }
    let active = true
    let buffered: EngineInfo | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    void manager.analyze(position, LIVE_LIMITS, (info) => {
      if (!active || info.multipv !== 1 || info.bound) return
      buffered = info
      timer ??= setTimeout(() => {
        timer = undefined
        if (active && buffered) setLatest({ fen: position.fen, info: buffered })
      }, UI_THROTTLE_MS)
    })

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [manager, position, enabled, terminal])

  const live = latest?.fen === position.fen ? latest.info : null
  let analysis: LiveAnalysis
  if (terminal) {
    analysis = { score: terminal, barScore: terminal, depth: null, bestMoveUci: null, pv: [], gameOver: true }
  } else if (live) {
    analysis = {
      score: live.score,
      barScore: live.score,
      depth: live.depth,
      bestMoveUci: live.pv[0] ?? null,
      pv: live.pv,
      gameOver: false,
    }
  } else if (known) {
    analysis = {
      score: known.score,
      barScore: known.score,
      depth: known.depth,
      bestMoveUci: known.bestMove,
      pv: known.lines[0]?.pv ?? [],
      gameOver: false,
    }
  } else {
    const previous = latest?.info.score ?? null
    analysis = { score: null, barScore: previous, depth: null, bestMoveUci: null, pv: [], gameOver: false }
  }

  return { analysis, status, fen: position.fen }
}
