import { describe, expect, it } from 'vitest'
import { winPercent } from './winPercent'

describe('winPercent', () => {
  it('cp 0 → 50%', () => {
    expect(winPercent({ kind: 'cp', value: 0 })).toBe(50)
  })

  it('đối xứng quanh 50% và khớp công thức lichess', () => {
    expect(winPercent({ kind: 'cp', value: 100 })).toBeCloseTo(59.1, 1)
    expect(winPercent({ kind: 'cp', value: -100 })).toBeCloseTo(40.9, 1)
    expect(winPercent({ kind: 'cp', value: 300 })).toBeCloseTo(75.15, 1)
  })

  it('kẹp cp trong ±1000', () => {
    expect(winPercent({ kind: 'cp', value: 5000 })).toBe(winPercent({ kind: 'cp', value: 1000 }))
    expect(winPercent({ kind: 'cp', value: -5000 })).toBe(winPercent({ kind: 'cp', value: -1000 }))
    expect(winPercent({ kind: 'cp', value: 1000 })).toBeLessThan(100)
  })

  it('mate và kết thúc ván', () => {
    expect(winPercent({ kind: 'mate', value: 4 })).toBe(100)
    expect(winPercent({ kind: 'mate', value: -1 })).toBe(0)
    expect(winPercent({ kind: 'gameover', outcome: 'win' })).toBe(100)
    expect(winPercent({ kind: 'gameover', outcome: 'loss' })).toBe(0)
    expect(winPercent({ kind: 'gameover', outcome: 'draw' })).toBe(50)
  })
})
