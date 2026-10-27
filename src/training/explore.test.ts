import { describe, expect, it } from 'vitest'
import { explorePlay, explorePosition, exploreSans, exploreStep, startExplore } from './explore'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('explore', () => {
  it('bắt đầu ở cuối các nước đã đi', () => {
    const e = startExplore(START, ['e2e4', 'e7e5'])
    expect(e.cursor).toBe(2)
    expect(explorePosition(e).lastMove?.san).toBe('e5')
    expect(exploreSans(e)).toEqual(['e4', 'e5'])
  })

  it('đi được quân của cả hai bên', () => {
    let e = startExplore(START, [])
    e = explorePlay(e, 'e2e4')!
    e = explorePlay(e, 'e7e5')!
    expect(e.moves).toEqual(['e2e4', 'e7e5'])
    expect(explorePosition(e).fen.split(' ')[1]).toBe('w')
  })

  it('nước không hợp lệ', () => {
    expect(explorePlay(startExplore(START, []), 'e2e5')).toBeNull()
  })

  it('lùi rồi đi nước khác thì bỏ phần sau; trùng nước kế thì giữ', () => {
    const e = exploreStep(startExplore(START, ['e2e4', 'e7e5', 'g1f3']), -2)
    expect(explorePosition(e).lastMove?.san).toBe('e4')
    const same = explorePlay(e, 'e7e5')!
    expect(same.moves).toEqual(['e2e4', 'e7e5', 'g1f3'])
    expect(same.cursor).toBe(2)
    const other = explorePlay(e, 'c7c5')!
    expect(other.moves).toEqual(['e2e4', 'c7c5'])
    expect(other.cursor).toBe(2)
  })

  it('exploreStep kẹp trong giới hạn', () => {
    const e = startExplore(START, ['e2e4'])
    expect(exploreStep(e, 5)).toBe(e)
    expect(exploreStep(e, -9).cursor).toBe(0)
    expect(explorePosition(exploreStep(e, -9)).lastMove).toBeNull()
  })

  it('phong cấp lưu đúng quân', () => {
    const e = explorePlay(startExplore('8/4P3/8/8/8/8/k7/4K3 w - - 0 1', []), 'e7e8n')!
    expect(e.moves).toEqual(['e7e8n'])
    expect(exploreSans(e)).toEqual(['e8=N'])
  })
})
