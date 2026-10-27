import { useEffect, useRef } from 'react'
import { squareAtPoint } from '../components/boardGeometry'

/**
 * Ô thả quân tính theo vị trí con trỏ lúc thả và vị trí thật của bàn cờ `#${id}-board`.
 * react-chessboard đo vị trí các ô lúc bắt đầu kéo; kéo nhanh (premove) thì có thể thả trước khi đo xong và
 * dùng số đo cũ (bàn cờ đã dịch đi vì thanh đánh giá, cột bên...) nên ô đích bị lệch một hàng.
 */
export function useDropSquare(id: string, orientation: 'white' | 'black') {
  const pointer = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const track = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointermove', track, { passive: true })
    window.addEventListener('pointerup', track, { passive: true })
    return () => {
      window.removeEventListener('pointermove', track)
      window.removeEventListener('pointerup', track)
    }
  }, [])

  /** Ô dưới con trỏ; không xác định được thì dùng ô do thư viện báo. */
  return (fallback: string | null): string | null => {
    const board = document.getElementById(`${id}-board`)
    const p = pointer.current
    if (!board || !p) return fallback
    return squareAtPoint(board.getBoundingClientRect(), p.x, p.y, orientation)
  }
}
