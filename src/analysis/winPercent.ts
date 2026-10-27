import type { Score } from '../types'

const CP_CLAMP = 1000

/**
 * Xác suất thắng (0–100) theo công thức công khai của lichess,
 * tính theo cùng góc nhìn với `score`.
 */
export function winPercent(score: Score): number {
  switch (score.kind) {
    case 'cp': {
      const cp = Math.min(Math.max(score.value, -CP_CLAMP), CP_CLAMP)
      return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
    }
    case 'mate':
      return score.value > 0 ? 100 : 0
    case 'gameover':
      return score.outcome === 'win' ? 100 : score.outcome === 'loss' ? 0 : 50
  }
}
