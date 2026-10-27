import { useEffect, useRef } from 'react'
import { moveSoundKind } from '../sound/moveSound'
import { playMoveSound } from '../sound/player'
import type { Ply } from '../types'

/** Phát âm thanh của nước đang hiển thị mỗi khi nó đổi (đi tới, lùi, nhảy nước, tự đi quân). */
export function useMoveSound(lastMove: Ply | null, enabled: boolean) {
  const previous = useRef<Ply | null>(lastMove)

  useEffect(() => {
    const changed = previous.current !== lastMove
    previous.current = lastMove
    if (!enabled || !changed || !lastMove) return
    playMoveSound(moveSoundKind(lastMove.san))
  }, [lastMove, enabled])
}
