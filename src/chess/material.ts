import type { Color } from '../types'

export type CapturedPiece = 'p' | 'n' | 'b' | 'r' | 'q'

const START_COUNT: Record<CapturedPiece, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 }
const VALUE: Record<CapturedPiece, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }
const ORDER: CapturedPiece[] = ['p', 'n', 'b', 'r', 'q']

export interface MaterialInfo {
  /** captured.w: quân của Đen mà Trắng đã ăn (xếp từ Tốt tới Hậu); captured.b tương tự. */
  captured: Record<Color, CapturedPiece[]>
  /** Chênh lệch vật chất theo góc nhìn từng bên (> 0 là hơn). */
  advantage: Record<Color, number>
}

/**
 * Quân đã bị ăn và chênh lệch vật chất, chỉ từ FEN (so với bộ quân đầy đủ).
 * Quân phong cấp làm số quân vượt bộ ban đầu: khi đó không tính là bị ăn (đếm âm thì bỏ qua).
 */
export function materialFromFen(fen: string): MaterialInfo {
  const board = fen.split(' ')[0]
  const count: Record<Color, Record<CapturedPiece, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  }
  for (const ch of board) {
    const lower = ch.toLowerCase() as CapturedPiece
    if (!(lower in VALUE)) continue
    count[ch === lower ? 'b' : 'w'][lower]++
  }

  const missing = (color: Color) =>
    ORDER.flatMap((p) => Array<CapturedPiece>(Math.max(0, START_COUNT[p] - count[color][p])).fill(p))
  const points = (color: Color) => ORDER.reduce((sum, p) => sum + count[color][p] * VALUE[p], 0)
  const diff = points('w') - points('b')

  return {
    captured: { w: missing('b'), b: missing('w') },
    advantage: { w: diff, b: 0 - diff }, // 0 - diff thay vì -diff: tránh -0
  }
}
