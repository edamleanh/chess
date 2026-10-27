import type { Color } from '../types'

// Theo code lichess (modules/analyse/.../AccuracyPercent.scala).

/** Accuracy của một nước (0–100) từ win% trước/sau, theo góc nhìn người đi. Có +1 "uncertainty bonus" như lichess. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (winBefore - winAfter)) - 3.166924740191411
  return clamp(raw + 1, 0, 100)
}

/**
 * Accuracy cả ván cho từng bên.
 * @param whiteWins win% của Trắng tại mọi vị trí: [0] là thế cờ đầu, [i] là sau nước thứ i.
 * @param firstColor bên đi nước đầu tiên.
 * Mỗi bên = trung bình của (trung bình có trọng số theo độ biến động) và (trung bình điều hòa).
 */
export function gameAccuracy(whiteWins: number[], firstColor: Color): Record<Color, number | null> {
  const moves = whiteWins.length - 1
  if (moves < 1) return { w: null, b: null }

  const windowSize = clamp(Math.floor(moves / 10), 2, 8)
  const windows: number[][] = []
  for (let i = 0; i < Math.min(windowSize, whiteWins.length) - 2; i++) windows.push(whiteWins.slice(0, windowSize))
  if (whiteWins.length <= windowSize) windows.push(whiteWins)
  else for (let i = 0; i + windowSize <= whiteWins.length; i++) windows.push(whiteWins.slice(i, i + windowSize))
  const weights = windows.map((xs) => clamp(standardDeviation(xs), 0.5, 12))

  const perColor: Record<Color, { accuracy: number; weight: number }[]> = { w: [], b: [] }
  for (let i = 0; i < moves; i++) {
    const color: Color = (i % 2 === 0) === (firstColor === 'w') ? 'w' : 'b'
    const [prev, next] = [whiteWins[i], whiteWins[i + 1]]
    const accuracy = color === 'w' ? moveAccuracy(prev, next) : moveAccuracy(100 - prev, 100 - next)
    perColor[color].push({ accuracy, weight: weights[i] })
  }

  const summarize = (xs: { accuracy: number; weight: number }[]) => {
    if (xs.length === 0) return null
    const totalWeight = xs.reduce((s, x) => s + x.weight, 0)
    const weighted = xs.reduce((s, x) => s + x.accuracy * x.weight, 0) / totalWeight
    // Như lichess (Maths.harmonicMean): mẫu kẹp ≥ 1, để một nước accuracy 0 không kéo cả trung bình về 0
    const harmonic = xs.length / xs.reduce((s, x) => s + 1 / Math.max(1, x.accuracy), 0)
    return (weighted + harmonic) / 2
  }
  return { w: summarize(perColor.w), b: summarize(perColor.b) }
}

function standardDeviation(xs: number[]): number {
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}
