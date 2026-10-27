import type { Color, GameModel } from '../types'

export interface TimeControl {
  /** Thời gian ban đầu (giây). */
  base: number
  /** Thời gian cộng thêm mỗi nước (giây). */
  increment: number
}

/** Header TimeControl: "600" → 10 phút, "180+2" → 3 phút + 2 s; ván Daily ("1/259200") hoặc "-" → null. */
export function parseTimeControl(value: string | undefined): TimeControl | null {
  const m = value?.match(/^(\d+)(?:\+(\d+))?$/)
  return m ? { base: Number(m[1]), increment: Number(m[2] ?? 0) } : null
}

/**
 * Thời gian người đi dùng cho từng nước (giây), từ đồng hồ còn lại sau mỗi nước.
 * spent = đồng hồ sau nước trước của cùng bên (hoặc thời gian ban đầu) − đồng hồ sau nước này + increment.
 * Không có đồng hồ hoặc không biết thể thức thì null.
 */
export function timeSpent(game: GameModel): (number | null)[] {
  const tc = parseTimeControl(game.headers.TimeControl)
  const lastClock: Record<Color, number | null> = { w: tc?.base ?? null, b: tc?.base ?? null }
  return game.plies.map((ply) => {
    const before = lastClock[ply.color]
    if (ply.clock === undefined) {
      lastClock[ply.color] = null
      return null
    }
    lastClock[ply.color] = ply.clock
    if (before === null) return null
    return Math.max(0, before - ply.clock + (tc?.increment ?? 0))
  })
}

/** Đồng hồ còn lại của mỗi bên tại vị trí `ply` (sau `ply` nước); null nếu không có. */
export function clocksAt(game: GameModel, ply: number): Record<Color, number | null> {
  const tc = parseTimeControl(game.headers.TimeControl)
  const result: Record<Color, number | null> = { w: tc?.base ?? null, b: tc?.base ?? null }
  for (const p of game.plies.slice(0, ply)) result[p.color] = p.clock ?? null
  return result
}

/** 598.5 → "9:58"; 3725 → "1:02:05"; dưới 10 s hiện thêm phần mười: 7.3 → "0:07.3". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const secText = s < 10 ? sec.toFixed(1).padStart(4, '0') : String(Math.floor(sec)).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${secText}` : `${m}:${secText}`
}

/** Thời gian trung bình mỗi nước của một bên (giây), bỏ qua nước không có dữ liệu. */
export function averageTime(game: GameModel, spent: (number | null)[], color: Color): number | null {
  const xs = spent.filter((s, i): s is number => s !== null && game.plies[i].color === color)
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}
