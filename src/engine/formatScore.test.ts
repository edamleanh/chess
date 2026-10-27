import { describe, expect, it } from 'vitest'
import { formatScore, formatScoreShort, whiteIsBetter } from './formatScore'

describe('formatScore', () => {
  it('cp có dấu và 2 chữ số', () => {
    expect(formatScore({ kind: 'cp', value: 123 })).toBe('+1.23')
    expect(formatScore({ kind: 'cp', value: -50 })).toBe('-0.50')
    expect(formatScore({ kind: 'cp', value: 0 })).toBe('0.00')
  })

  it('mate và kết thúc ván', () => {
    expect(formatScore({ kind: 'mate', value: 3 })).toBe('M3')
    expect(formatScore({ kind: 'mate', value: -2 })).toBe('-M2')
    expect(formatScore({ kind: 'gameover', outcome: 'win' })).toBe('1-0')
    expect(formatScore({ kind: 'gameover', outcome: 'loss' })).toBe('0-1')
    expect(formatScore({ kind: 'gameover', outcome: 'draw' })).toBe('½-½')
  })
})

describe('formatScoreShort / whiteIsBetter', () => {
  it('nhãn eval bar không dấu, vị trí do whiteIsBetter quyết định', () => {
    expect(formatScoreShort({ kind: 'cp', value: -340 })).toBe('3.4')
    expect(formatScoreShort({ kind: 'mate', value: -2 })).toBe('M2')
    expect(whiteIsBetter({ kind: 'cp', value: -340 })).toBe(false)
    expect(whiteIsBetter({ kind: 'cp', value: 0 })).toBe(true)
    expect(whiteIsBetter({ kind: 'mate', value: 1 })).toBe(true)
    expect(whiteIsBetter({ kind: 'gameover', outcome: 'loss' })).toBe(false)
  })
})
