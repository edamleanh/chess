import type { GameModel } from '../types'

/**
 * EPD → [mã ECO, tên khai cuộc] cho thế cờ có tên, hoặc 0 cho thế cờ trung gian (vẫn là lý thuyết, không có tên).
 * Sinh bởi scripts/build-openings.mjs từ lichess-org/chess-openings (CC0). Kiểu rộng vì TypeScript suy từ JSON.
 */
export type OpeningDb = Record<string, string[] | number>

export interface Opening {
  eco: string
  name: string
}

export interface OpeningInfo {
  /** Số nước liên tiếp từ đầu ván nằm trong lý thuyết khai cuộc (nhãn "Book"). */
  bookPlies: number
  /** Khai cuộc của thế cờ có tên sâu nhất trong phần Book; null nếu không có. */
  opening: Opening | null
  /** byPly[i]: khai cuộc có tên sâu nhất tính tới hết nước i (chỉ trong phần Book). */
  byPly: (Opening | null)[]
}

const STANDARD_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
const NONE: OpeningInfo = { bookPlies: 0, opening: null, byPly: [] }

/** 4 trường đầu của FEN (bỏ đếm nước), dùng làm khóa tra cứu. */
export function epd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ')
}

/**
 * Nhận diện khai cuộc của ván. Book chỉ tính các nước liên tiếp từ đầu ván; lệch khỏi lý thuyết một lần
 * là dừng, dù sau đó có chuyển thế về một vị trí có trong dữ liệu.
 */
export function detectOpening(game: GameModel, db: OpeningDb): OpeningInfo {
  if (epd(game.startFen) !== STANDARD_START) return NONE

  let opening: Opening | null = null
  const byPly: (Opening | null)[] = []
  for (const ply of game.plies) {
    const key = epd(ply.fenAfter)
    if (!(key in db)) break
    const entry = db[key]
    if (Array.isArray(entry)) opening = { eco: entry[0], name: entry[1] }
    byPly.push(opening)
  }
  return { bookPlies: byPly.length, opening, byPly }
}

let dbPromise: Promise<OpeningDb> | null = null

/** Tải dữ liệu khai cuộc (chunk riêng, khoảng 100 KB gzip) một lần; lỗi thì lần sau thử tải lại. */
export function loadOpeningDb(): Promise<OpeningDb> {
  dbPromise ??= import('./openings.json').then(
    (m): OpeningDb => m.default,
    (e: unknown) => {
      dbPromise = null
      throw e
    },
  )
  return dbPromise
}
