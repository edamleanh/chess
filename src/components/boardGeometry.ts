const FILES = 'abcdefgh'

export interface BoardRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Ô dưới điểm (x, y) trên bàn cờ 8×8 đang hiển thị ở `rect`; null nếu nằm ngoài bàn.
 * Dùng khi thả quân: react-chessboard (dnd-kit) có thể còn giữ vị trí ô đo từ bố cục cũ nếu kéo nhanh,
 * nên tính lại theo vị trí thật của bàn cờ lúc thả.
 */
export function squareAtPoint(rect: BoardRect, x: number, y: number, orientation: 'white' | 'black'): string | null {
  const col = Math.floor(((x - rect.left) / rect.width) * 8)
  const row = Math.floor(((y - rect.top) / rect.height) * 8)
  if (col < 0 || col > 7 || row < 0 || row > 7) return null
  return orientation === 'white' ? `${FILES[col]}${8 - row}` : `${FILES[7 - col]}${row + 1}`
}
