import { Chess, type PieceSymbol, type Square } from 'chess.js'
import { terminalScore } from '../chess/terminal'

/** Bài chiếu hết cơ bản: Trắng có Vua + quân này, Đen chỉ có Vua (Stockfish phòng thủ). */
export type EndgameKind = 'KQ' | 'KR' | 'KBB' | 'KBN'

export const ENDGAMES: Record<EndgameKind, { label: string; pieces: PieceSymbol[] }> = {
  KQ: { label: 'Vua + Hậu', pieces: ['q'] },
  KR: { label: 'Vua + Xe', pieces: ['r'] },
  KBB: { label: 'Vua + 2 Tượng', pieces: ['b', 'b'] },
  KBN: { label: 'Vua + Tượng + Mã', pieces: ['b', 'n'] },
}

const FILES = 'abcdefgh'

function squareOf(index: number): Square {
  return `${FILES[index % 8]}${Math.floor(index / 8) + 1}` as Square
}

const isLight = (sq: Square) => (FILES.indexOf(sq[0]) + Number(sq[1])) % 2 === 1

/** Bộ sinh số ngẫu nhiên có seed (mulberry32), để test tái lập được. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Thế cờ ngẫu nhiên hợp lệ, Trắng đi trước: Vua hai bên không kề nhau, Đen không bị chiếu,
 * Trắng có nước đi và chưa kết thúc ván; 2 Tượng (nếu có) đứng khác màu ô.
 * Vua Đen không đứng ở mép bàn ngay từ đầu, để bài có ý nghĩa (phải dồn Vua).
 */
export function randomEndgame(kind: EndgameKind, random: () => number = Math.random): string {
  const pieces = ENDGAMES[kind].pieces
  for (;;) {
    const used = new Set<number>()
    const pick = () => {
      let i: number
      do i = Math.floor(random() * 64)
      while (used.has(i))
      used.add(i)
      return squareOf(i)
    }
    const chess = new Chess()
    chess.clear()
    const whiteKing = pick()
    const blackKing = pick()
    const placed = pieces.map((type) => ({ type, square: pick() }))

    const [wf, wr] = [FILES.indexOf(whiteKing[0]), Number(whiteKing[1])]
    const [bf, br] = [FILES.indexOf(blackKing[0]), Number(blackKing[1])]
    if (Math.abs(wf - bf) <= 1 && Math.abs(wr - br) <= 1) continue // Vua kề nhau
    if (bf === 0 || bf === 7 || br === 1 || br === 8) continue // Vua Đen ở mép
    const bishops = placed.filter((p) => p.type === 'b')
    if (bishops.length === 2 && isLight(bishops[0].square) === isLight(bishops[1].square)) continue

    chess.put({ type: 'k', color: 'w' }, whiteKing)
    chess.put({ type: 'k', color: 'b' }, blackKing)
    placed.forEach((p) => chess.put({ type: p.type, color: 'w' }, p.square))

    // Đen không được đang bị chiếu khi tới lượt Trắng (thế cờ không hợp lệ)
    if (chess.isAttacked(blackKing, 'w')) continue
    const fen = chess.fen() // put() giữ lượt Trắng
    const check = new Chess(fen)
    if (check.isGameOver()) continue
    // Có ít nhất một nước để Đen không ăn được quân nào (vd. Mã bị nhốt ở góc cạnh Vua đen thì bỏ)
    const safe = check.moves({ verbose: true }).some((m) => {
      const after = new Chess(fen)
      after.move(m.lan)
      return !after.moves({ verbose: true }).some((r) => r.captured)
    })
    if (!safe) continue
    return fen
  }
}

/**
 * Kết quả bài chiếu hết cơ bản sau các nước đã đi (UCI, từ `startFen`): 'win' khi Đen bị chiếu hết;
 * 'draw' (tính là thua bài) khi hòa pat, Đen ăn mất quân (không đủ quân), luật 50 nước, lặp 3 lần.
 */
export function endgameResult(startFen: string, moves: string[]): 'win' | 'draw' | null {
  const score = terminalScore({ fen: startFen, startFen, moves })
  if (!score || score.kind !== 'gameover') return null
  return score.outcome === 'win' ? 'win' : 'draw'
}
