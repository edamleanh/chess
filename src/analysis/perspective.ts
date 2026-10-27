import type { Color, Score } from '../types'

/** Đảo góc nhìn của score (Trắng ↔ Đen). */
export function negateScore(score: Score): Score {
  switch (score.kind) {
    case 'cp':
    case 'mate':
      return { kind: score.kind, value: -score.value }
    case 'gameover':
      return {
        kind: 'gameover',
        outcome: score.outcome === 'win' ? 'loss' : score.outcome === 'loss' ? 'win' : 'draw',
      }
  }
}

/** Đổi score từ góc nhìn Trắng sang góc nhìn của bên `color`. */
export function scoreForMover(whiteScore: Score, color: Color): Score {
  return color === 'w' ? whiteScore : negateScore(whiteScore)
}
