import { describe, expect, it } from 'vitest'
import { moveSoundKind } from './moveSound'

describe('moveSoundKind', () => {
  it.each([
    ['e4', 'move'],
    ['Nf3', 'move'],
    ['exd5', 'capture'],
    ['Bxf7+', 'check'],
    ['O-O', 'castle'],
    ['O-O-O', 'castle'],
    ['O-O+', 'check'],
    ['e8=Q', 'promote'],
    ['exd8=N', 'promote'],
    ['e8=Q+', 'check'],
    ['Qxf7#', 'mate'],
    ['e8=Q#', 'mate'],
  ])('%s → %s', (san, kind) => {
    expect(moveSoundKind(san)).toBe(kind)
  })
})
