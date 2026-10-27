import { useState, type CSSProperties } from 'react'

/** Ô được đánh dấu bằng chuột phải (giống chess.com). */
export const MARK_STYLE: CSSProperties = { backgroundColor: 'rgba(235, 97, 80, 0.8)' }

/**
 * Đánh dấu ô bằng chuột phải: bấm lại để bỏ. Như mũi tên của react-chessboard, dấu tự xóa khi bấm chuột trái
 * hoặc khi thế cờ đổi (gắn với `fen`).
 */
export function useSquareMarks(fen: string) {
  const [state, setState] = useState<{ fen: string; squares: string[] }>({ fen, squares: [] })
  const marks = state.fen === fen ? state.squares : []

  return {
    marks,
    toggle: (square: string) =>
      setState({ fen, squares: marks.includes(square) ? marks.filter((s) => s !== square) : [...marks, square] }),
    clear: () => {
      if (marks.length) setState({ fen, squares: [] })
    },
  }
}
