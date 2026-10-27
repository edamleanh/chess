import { describe, expect, it } from 'vitest'
import { squareAtPoint } from './boardGeometry'

const RECT = { left: 100, top: 50, width: 800, height: 800 }

describe('squareAtPoint', () => {
  it('bàn trắng ở dưới', () => {
    expect(squareAtPoint(RECT, 150, 100, 'white')).toBe('a8')
    expect(squareAtPoint(RECT, 850, 800, 'white')).toBe('h1')
    expect(squareAtPoint(RECT, 550, 140, 'white')).toBe('e8')
    expect(squareAtPoint(RECT, 550, 160, 'white')).toBe('e7')
  })

  it('bàn lật (đen ở dưới)', () => {
    expect(squareAtPoint(RECT, 150, 100, 'black')).toBe('h1')
    expect(squareAtPoint(RECT, 850, 800, 'black')).toBe('a8')
  })

  it('ngoài bàn cờ', () => {
    expect(squareAtPoint(RECT, 99, 100, 'white')).toBeNull()
    expect(squareAtPoint(RECT, 150, 850, 'white')).toBeNull()
  })
})
