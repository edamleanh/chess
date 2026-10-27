import type { Score } from '../types'

/** Hiển thị score theo góc nhìn Trắng: "+1.23", "-0.50", "0.00", "M3", "-M3", "1-0", "0-1", "½-½". */
export function formatScore(whiteScore: Score): string {
  switch (whiteScore.kind) {
    case 'cp': {
      const pawns = whiteScore.value / 100
      if (Math.abs(pawns) < 0.005) return '0.00'
      return (pawns > 0 ? '+' : '') + pawns.toFixed(2)
    }
    case 'mate':
      return (whiteScore.value < 0 ? '-M' : 'M') + Math.abs(whiteScore.value)
    case 'gameover':
      return whiteScore.outcome === 'win' ? '1-0' : whiteScore.outcome === 'loss' ? '0-1' : '½-½'
  }
}

/** Nhãn ngắn cho eval bar: "1.2", "M3"; không kèm dấu, vì vị trí nhãn trên thanh đã cho biết bên nào hơn. */
export function formatScoreShort(whiteScore: Score): string {
  switch (whiteScore.kind) {
    case 'cp':
      return (Math.abs(whiteScore.value) / 100).toFixed(1)
    case 'mate':
      return 'M' + Math.abs(whiteScore.value)
    case 'gameover':
      return formatScore(whiteScore)
  }
}

/** Trắng đang hơn hoặc cân bằng. Dùng để đặt nhãn ở phía Trắng hay phía Đen của eval bar. */
export function whiteIsBetter(whiteScore: Score): boolean {
  switch (whiteScore.kind) {
    case 'cp':
    case 'mate':
      return whiteScore.value >= 0
    case 'gameover':
      return whiteScore.outcome !== 'loss'
  }
}
