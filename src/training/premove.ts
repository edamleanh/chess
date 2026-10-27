import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'

/** Nước premove: xếp sẵn trong lượt đối phương, tự đi ngay khi tới lượt (nếu hợp lệ). */
export interface Premove {
  from: string
  to: string
  promotion?: string
}

export const premoveUci = (p: Premove) => `${p.from}${p.to}${p.promotion ?? ''}`

const FILES = 'abcdefgh'
const fileOf = (sq: string) => FILES.indexOf(sq[0])
const rankOf = (sq: string) => Number(sq[1])

type Board = Map<string, { type: PieceSymbol; color: Color }>

function boardOf(fen: string): Board {
  const board: Board = new Map()
  fen
    .split(' ')[0]
    .split('/')
    .forEach((row, r) => {
      let f = 0
      for (const ch of row) {
        if (/\d/.test(ch)) f += Number(ch)
        else {
          const color: Color = ch === ch.toUpperCase() ? 'w' : 'b'
          board.set(`${FILES[f]}${8 - r}`, { type: ch.toLowerCase() as PieceSymbol, color })
          f++
        }
      }
    })
  return board
}

function boardToFen(board: Board, turn: Color): string {
  const rows: string[] = []
  for (let r = 8; r >= 1; r--) {
    let row = ''
    let empty = 0
    for (let f = 0; f < 8; f++) {
      const piece = board.get(`${FILES[f]}${r}`)
      if (!piece) {
        empty++
        continue
      }
      if (empty) row += empty
      empty = 0
      row += piece.color === 'w' ? piece.type.toUpperCase() : piece.type
    }
    rows.push(row + (empty || ''))
  }
  // Bàn ảo: không theo dõi quyền nhập thành / bắt tốt qua đường (premove chỉ kiểm tra hình học)
  return `${rows.join('/')} ${turn} - - 0 1`
}

/**
 * Thế cờ "ảo" sau khi áp các premove: quân của người chơi di chuyển trên bàn, bỏ qua lượt của đối phương.
 * Dùng để hiển thị premove và để kiểm tra premove tiếp theo.
 */
export function virtualFen(fen: string, premoves: Premove[], color: Color): string {
  const board = boardOf(fen)
  for (const p of premoves) {
    const piece = board.get(p.from)
    if (!piece) continue
    board.delete(p.from)
    board.set(p.to, p.promotion ? { type: p.promotion as PieceSymbol, color: piece.color } : piece)
    // Nhập thành: Vua đi 2 ô thì Xe đi theo
    if (piece.type === 'k' && Math.abs(fileOf(p.to) - fileOf(p.from)) === 2) {
      const rank = rankOf(p.from)
      const [rookFrom, rookTo] = fileOf(p.to) === 6 ? [`h${rank}`, `f${rank}`] : [`a${rank}`, `d${rank}`]
      const rook = board.get(rookFrom)
      if (rook) {
        board.delete(rookFrom)
        board.set(rookTo, rook)
      }
    }
  }
  return boardToFen(board, color)
}

/**
 * Các ô premove được: theo cách quân đi, không xét quân chắn đường (lúc tới lượt có thể đã thông).
 * Tốt được premove ăn chéo vào ô trống (đề phòng đối phương đi quân vào đó). Được nhắm cả ô có quân mình
 * (ăn lại sau khi đối phương ăn quân đó), như lichess/chess.com.
 */
export function premoveTargets(fen: string, from: string): string[] {
  const board = boardOf(fen)
  const piece = board.get(from)
  if (!piece) return []
  const f0 = fileOf(from)
  const r0 = rankOf(from)
  const out: string[] = []
  const add = (f: number, r: number) => {
    if (f < 0 || f > 7 || r < 1 || r > 8) return
    out.push(`${FILES[f]}${r}`)
  }
  const slide = (dirs: [number, number][]) => {
    for (const [df, dr] of dirs) for (let k = 1; k < 8; k++) add(f0 + df * k, r0 + dr * k)
  }
  const ROOK: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const BISHOP: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]

  switch (piece.type) {
    case 'n':
      for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) add(f0 + df, r0 + dr)
      break
    case 'b':
      slide(BISHOP)
      break
    case 'r':
      slide(ROOK)
      break
    case 'q':
      slide([...ROOK, ...BISHOP])
      break
    case 'k': {
      for (const [df, dr] of [...ROOK, ...BISHOP]) add(f0 + df, r0 + dr)
      const home = piece.color === 'w' ? 1 : 8
      if (from === `e${home}`) {
        if (board.get(`h${home}`)?.type === 'r') add(6, home)
        if (board.get(`a${home}`)?.type === 'r') add(2, home)
      }
      break
    }
    case 'p': {
      const dir = piece.color === 'w' ? 1 : -1
      const start = piece.color === 'w' ? 2 : 7
      add(f0, r0 + dir)
      if (r0 === start) add(f0, r0 + 2 * dir)
      add(f0 - 1, r0 + dir)
      add(f0 + 1, r0 + dir)
      break
    }
  }
  return out
}

/** Premove từ `from` tới `to` là Tốt lên hàng cuối (cần chọn quân phong cấp). */
export function premoveNeedsPromotion(fen: string, from: string, to: string): boolean {
  const piece = boardOf(fen).get(from)
  return piece?.type === 'p' && (rankOf(to) === 8 || rankOf(to) === 1)
}

/**
 * Tới lượt người chơi: lấy premove đầu hàng đợi. Hợp lệ trong thế cờ thật thì trả về để đi ngay;
 * không hợp lệ thì hủy cả hàng đợi (giống chess.com).
 */
export function takePremove(realFen: string, queue: Premove[]): { uci: string | null; rest: Premove[] } {
  const [first, ...rest] = queue
  if (!first) return { uci: null, rest: [] }
  const chess = new Chess(realFen)
  try {
    const move = chess.move({ from: first.from as Square, to: first.to as Square, promotion: first.promotion })
    return { uci: move.lan, rest }
  } catch {
    return { uci: null, rest: [] }
  }
}
