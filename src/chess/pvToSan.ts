import { Chess } from 'chess.js'

/** Đổi chuỗi nước UCI (biến chính của engine) sang SAN, dừng tại nước đầu tiên không hợp lệ. */
export function pvToSan(fen: string, uciMoves: string[]): string[] {
  const chess = new Chess(fen)
  const san: string[] = []
  for (const uci of uciMoves) {
    try {
      const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      san.push(move.san)
    } catch {
      break
    }
  }
  return san
}
