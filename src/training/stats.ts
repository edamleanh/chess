/** Thống kê luyện tập của người chơi (lưu localStorage). */
export interface TrainingStats {
  solved: number
  attempted: number
  streak: number
  bestStreak: number
}

export const EMPTY_STATS: TrainingStats = { solved: 0, attempted: 0, streak: 0, bestStreak: 0 }

export function recordResult(stats: TrainingStats, solved: boolean): TrainingStats {
  const streak = solved ? stats.streak + 1 : 0
  return {
    solved: stats.solved + (solved ? 1 : 0),
    attempted: stats.attempted + 1,
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
  }
}

/** Đọc lại từ JSON đã lưu; dữ liệu hỏng thì về rỗng. */
export function parseStats(raw: string | null): TrainingStats {
  if (!raw) return EMPTY_STATS
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return EMPTY_STATS
    const v = value as Record<string, unknown>
    const num = (k: keyof TrainingStats) => (typeof v[k] === 'number' && Number.isFinite(v[k]) && (v[k] as number) >= 0 ? (v[k] as number) : 0)
    return { solved: num('solved'), attempted: num('attempted'), streak: num('streak'), bestStreak: num('bestStreak') }
  } catch {
    return EMPTY_STATS
  }
}
