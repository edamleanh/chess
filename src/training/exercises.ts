import { ENDGAMES, randomEndgame, type EndgameKind } from './endgames'
import type { Puzzle } from './puzzle'
import type { Task } from './session'

/** Loại bài người chơi chọn. Puzzle mức 4 gồm cả Mate in 4 và 5+. */
export type ExerciseId = 'm1' | 'm2' | 'm3' | 'm45' | 'm13' | 'mix' | EndgameKind

export const EXERCISES: { id: ExerciseId; label: string; group: 'puzzle' | 'endgame' }[] = [
  { id: 'm1', label: 'Chiếu hết sau 1 nước', group: 'puzzle' },
  { id: 'm2', label: 'Chiếu hết sau 2 nước', group: 'puzzle' },
  { id: 'm3', label: 'Chiếu hết sau 3 nước', group: 'puzzle' },
  { id: 'm45', label: 'Chiếu hết sau 4–5+ nước', group: 'puzzle' },
  { id: 'm13', label: 'Ngẫu nhiên (1–3 nước)', group: 'puzzle' },
  { id: 'mix', label: 'Ngẫu nhiên (1–5 nước)', group: 'puzzle' },
  ...(Object.keys(ENDGAMES) as EndgameKind[]).map((id) => ({ id, label: ENDGAMES[id].label, group: 'endgame' as const })),
]

export const isEndgame = (id: ExerciseId): id is EndgameKind => id in ENDGAMES

/** Giới hạn thời gian mỗi bài (giây): puzzle ngắn, chiếu hết cơ bản dài hơn. */
export const TIME_LIMITS = { puzzle: [15, 30, 60], endgame: [60, 120, 180] } as const

/** Thời gian đối phương "nghĩ" trước khi đi (ms): khoảng để người chơi xếp premove. */
export const OPPONENT_DELAYS = [500, 1500, 3000] as const
export const DEFAULT_OPPONENT_DELAY = 1500

const LEVELS: Record<Exclude<ExerciseId, EndgameKind>, (mateIn: number) => boolean> = {
  m1: (n) => n === 1,
  m2: (n) => n === 2,
  m3: (n) => n === 3,
  m45: (n) => n >= 4,
  m13: (n) => n <= 3,
  mix: () => true,
}

/** Các puzzle thuộc loại bài `id` (rỗng với chiếu hết cơ bản). */
export function puzzlesFor(id: ExerciseId, puzzles: Puzzle[]): Puzzle[] {
  return isEndgame(id) ? [] : puzzles.filter((p) => LEVELS[id](p.mateIn))
}

/**
 * Bài mới ngẫu nhiên. Puzzle: chỉ chọn trong các bài chưa gặp (`seen`) để không bị trùng; đã gặp hết thì chọn
 * trong cả mức (người gọi bắt đầu vòng mới bằng cách xóa các bài của mức khỏi `seen`). null nếu không có bài.
 */
export function pickTask(
  id: ExerciseId,
  puzzles: Puzzle[],
  seen: ReadonlySet<string> = new Set(),
  random: () => number = Math.random,
): Task | null {
  if (isEndgame(id)) return { kind: 'endgame', endgame: id, fen: randomEndgame(id, random) }
  const pool = puzzlesFor(id, puzzles)
  if (pool.length === 0) return null
  const fresh = pool.filter((p) => !seen.has(p.id))
  const from = fresh.length ? fresh : pool
  return { kind: 'puzzle', puzzle: from[Math.floor(random() * from.length)] }
}
