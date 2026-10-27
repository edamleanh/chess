import { useCallback, useEffect, useMemo, useState } from 'react'
import * as nav from '../chess/exploration'
import type { GameModel } from '../types'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/**
 * Điều hướng trong một ván: tới/lui (phím ←/→/Home/End), nhảy tới nước bất kỳ, và đi thử nước khác
 * trên bàn cờ (biến phụ, xem src/chess/exploration.ts). Muốn reset khi đổi ván thì đổi `key` của component.
 */
/** `keyboard`: bật phím ←/→/Home/End (tắt khi màn review đang bị ẩn). */
export function useGameNavigation(game: GameModel, keyboard = true) {
  const [state, setState] = useState<nav.ReviewState>(nav.INITIAL_STATE)

  const goTo = useCallback((ply: number) => setState(nav.goToMain(game, ply)), [game])
  const goPrev = useCallback(() => setState((s) => nav.prev(game, s)), [game])
  const goNext = useCallback(() => setState((s) => nav.next(game, s)), [game])
  const goFirst = useCallback(() => setState(nav.first()), [])
  const goLast = useCallback(() => setState((s) => nav.last(game, s)), [game])
  const goToVariation = useCallback((cursor: number) => setState((s) => nav.goToVariation(s, cursor)), [])
  const exitVariation = useCallback(() => setState((s) => nav.exitVariation(s)), [])

  /** Đi một nước (UCI) tại vị trí đang xem; false nếu không hợp lệ (bàn cờ trả quân về chỗ cũ). */
  const playMove = useCallback(
    (uci: string): boolean => {
      const result = nav.playMove(game, state, uci)
      if (!result) return false
      setState(result)
      return true
    },
    [game, state],
  )

  useEffect(() => {
    if (!keyboard) return
    const handlers: Record<string, () => void> = {
      ArrowLeft: goPrev,
      ArrowRight: goNext,
      Home: goFirst,
      End: goLast,
    }
    function onKeyDown(e: KeyboardEvent) {
      const handler = handlers[e.key]
      if (!handler || isTypingTarget(e.target)) return
      e.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyboard, goPrev, goNext, goFirst, goLast])

  const position = useMemo(() => nav.currentPosition(game, state), [game, state])
  const variation = state.variation

  return {
    /** Vị trí trên ván chính (điểm rẽ nhánh nếu đang ở biến phụ). */
    ply: state.ply,
    total: game.plies.length,
    variation,
    /** Đang xem một nước của biến phụ (không phải đứng ở điểm rẽ nhánh). */
    inVariation: variation !== null && variation.cursor > 0,
    fen: position.fen,
    position,
    lastMove: nav.currentLastMove(game, state),
    atStart: state.ply === 0 && !variation,
    atEnd: variation ? variation.cursor === variation.moves.length : state.ply === game.plies.length,
    goTo,
    goPrev,
    goNext,
    goFirst,
    goLast,
    goToVariation,
    exitVariation,
    playMove,
  }
}
