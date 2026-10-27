import { describe, expect, it } from 'vitest'
import { pvToSan } from './pvToSan'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('pvToSan', () => {
  it('đổi UCI sang SAN', () => {
    expect(pvToSan(START, ['e2e4', 'e7e5', 'g1f3', 'b8c6'])).toEqual(['e4', 'e5', 'Nf3', 'Nc6'])
  })

  it('xử lý nhập thành và phong cấp', () => {
    expect(pvToSan('r3k3/8/8/8/8/8/8/4K2R w Kq - 0 1', ['e1g1', 'e8c8'])).toEqual(['O-O', 'O-O-O'])
    expect(pvToSan('8/P7/8/8/8/8/8/k6K w - - 0 1', ['a7a8q'])).toEqual(['a8=Q+'])
  })

  it('dừng ở nước không hợp lệ đầu tiên', () => {
    expect(pvToSan(START, ['e2e4', 'e2e4', 'g1f3'])).toEqual(['e4'])
    expect(pvToSan(START, [])).toEqual([])
  })
})
