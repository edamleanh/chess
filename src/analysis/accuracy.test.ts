import { describe, expect, it } from 'vitest'
import { gameAccuracy, moveAccuracy } from './accuracy'

describe('moveAccuracy', () => {
  it('không tụt win% → 100', () => {
    expect(moveAccuracy(50, 50)).toBe(100)
    expect(moveAccuracy(60, 70)).toBe(100)
  })

  it('khớp công thức lichess (kể cả +1)', () => {
    // 103.1668 · e^(−0.04354·10) − 3.1669 + 1 ≈ 64.58
    expect(moveAccuracy(50, 40)).toBeCloseTo(64.58, 1)
  })

  it('kẹp trong [0, 100]', () => {
    expect(moveAccuracy(100, 0)).toBe(0)
    expect(moveAccuracy(50, 49.99)).toBeLessThanOrEqual(100)
  })
})

describe('gameAccuracy', () => {
  it('toàn nước không tụt → cả hai bên 100', () => {
    expect(gameAccuracy([50, 50, 50, 50, 50], 'w')).toEqual({ w: 100, b: 100 })
  })

  it('một Blunder của Đen chỉ kéo Accuracy của Đen xuống', () => {
    // nước 4 (Đen) làm win% của Trắng tăng 50 → 80
    const acc = gameAccuracy([50, 50, 50, 50, 80, 80, 80], 'w')
    expect(acc.w).toBe(100)
    expect(acc.b).not.toBeNull()
    expect(acc.b!).toBeLessThan(60)
  })

  it('ván bắt đầu bằng nước của Đen', () => {
    const acc = gameAccuracy([50, 80], 'b')
    expect(acc.w).toBeNull()
    expect(acc.b!).toBeLessThan(30)
  })

  it('nước accuracy 0 không kéo trung bình điều hòa về 0 (mẫu kẹp ≥ 1 như lichess)', () => {
    // Trắng đi một nước tụt 100 → 0 (accuracy 0): weighted = 0, harmonic = 1 / (1/1) = 1
    expect(gameAccuracy([100, 0, 0], 'w').w).toBeCloseTo(0.5, 5)
  })

  it('không có nước nào → null', () => {
    expect(gameAccuracy([50], 'w')).toEqual({ w: null, b: null })
  })
})
