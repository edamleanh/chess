import { Chess, type PieceSymbol, type Square } from 'chess.js'

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

/** Phải mất trắng ít nhất chừng này (theo giá trị quân) mới coi là thí quân. */
const MIN_MATERIAL_GIVEN = 2

/**
 * Heuristic: nước đi để Mã/Tượng/Xe/Hậu đứng ở ô mà đối phương ăn được (bằng nước hợp lệ) và lỗ vật chất.
 * Lỗ = giá trị quân − quân vừa ăn − (nếu có quân bảo vệ: quân rẻ nhất của đối phương sẽ mất khi ăn lại).
 * Không tính nước phong cấp và nước chiếu hết. Chỉ xét quân vừa đi, không xét quân khác bị bỏ lại.
 */
export function isSacrifice(fenBefore: string, uci: string): boolean {
  const chess = new Chess(fenBefore)
  let move
  try {
    move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return false
  }

  // Phong cấp vào ô bị khống chế thường là đổi Tốt lấy quân, không phải thí quân
  if (move.promotion || VALUE[move.piece] < VALUE.n || chess.isCheckmate()) return false

  const to = move.to as Square
  // Chỉ nước ăn hợp lệ mới tính: quân bị ghim hoặc bên đang bị chiếu có thể không ăn được
  const captures = chess.moves({ verbose: true }).filter((m) => m.to === to)
  if (captures.length === 0) return false

  const defended = chess.attackers(to, move.color).length > 0
  const cheapestAttacker = Math.min(...captures.map((m) => VALUE[m.piece]))
  const captured = move.captured ? VALUE[move.captured] : 0
  const given = VALUE[move.piece] - captured - (defended ? cheapestAttacker : 0)
  return given >= MIN_MATERIAL_GIVEN
}
