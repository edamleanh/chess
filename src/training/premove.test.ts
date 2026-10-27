import { describe, expect, it } from 'vitest'
import { premoveNeedsPromotion, premoveTargets, premoveUci, takePremove, virtualFen } from './premove'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('virtualFen', () => {
  it('áp nhiều premove liên tiếp lên bàn, bỏ qua lượt đối phương', () => {
    const fen = virtualFen(START, [{ from: 'e2', to: 'e4' }, { from: 'g1', to: 'f3' }], 'w')
    expect(fen.split(' ')[0]).toBe('rnbqkbnr/pppppppp/8/8/4P3/5N2/PPPP1PPP/RNBQKB1R')
  })

  it('nhập thành: Xe đi theo Vua', () => {
    const fen = virtualFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', [{ from: 'e1', to: 'g1' }], 'w')
    expect(fen.split(' ')[0]).toBe('r3k2r/8/8/8/8/8/8/R4RK1')
  })

  it('phong cấp', () => {
    const fen = virtualFen('8/4P3/8/8/8/8/k7/4K3 b - - 0 1', [{ from: 'e7', to: 'e8', promotion: 'n' }], 'w')
    expect(fen.split(' ')[0]).toBe('4N3/8/8/8/8/8/k7/4K3')
  })
})

describe('premoveTargets', () => {
  it('Xe trượt qua quân chắn (lúc tới lượt có thể đã thông), nhắm được cả ô có quân mình', () => {
    const fen = '4k3/8/8/8/R2p3P/8/8/4K3 b - - 0 1'
    const targets = premoveTargets(fen, 'a4')
    expect(targets).toContain('g4') // qua quân đen ở d4
    expect(targets).toContain('h4') // Tốt trắng: ăn lại nếu nó bị ăn
    expect(targets).toContain('a8')
  })

  it('Tốt được premove ăn chéo vào ô trống và đi 2 ô từ hàng xuất phát', () => {
    expect(premoveTargets(START, 'e2').sort()).toEqual(['d3', 'e3', 'e4', 'f3'])
  })

  it('Vua có ô nhập thành khi Xe còn ở góc', () => {
    expect(premoveTargets('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1')).toEqual(expect.arrayContaining(['g1', 'c1']))
  })

  it('ô trống thì không có nước', () => {
    expect(premoveTargets(START, 'e4')).toEqual([])
  })
})

describe('takePremove', () => {
  it('premove hợp lệ thì đi, giữ phần còn lại của hàng đợi', () => {
    const queue = [{ from: 'e2', to: 'e4' }, { from: 'g1', to: 'f3' }]
    const result = takePremove(START, queue)
    expect(result.uci).toBe('e2e4')
    expect(result.rest).toEqual([{ from: 'g1', to: 'f3' }])
  })

  it('premove không hợp lệ thì hủy cả hàng đợi', () => {
    const queue = [{ from: 'e2', to: 'd3' }, { from: 'g1', to: 'f3' }]
    expect(takePremove(START, queue)).toEqual({ uci: null, rest: [] })
  })

  it('hàng đợi rỗng', () => {
    expect(takePremove(START, [])).toEqual({ uci: null, rest: [] })
  })

  it('phong cấp giữ quân đã chọn', () => {
    const fen = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1'
    expect(takePremove(fen, [{ from: 'e7', to: 'e8', promotion: 'r' }]).uci).toBe('e7e8r')
  })
})

it('premoveNeedsPromotion và premoveUci', () => {
  expect(premoveNeedsPromotion('8/4P3/8/8/8/8/k7/4K3 b - - 0 1', 'e7', 'e8')).toBe(true)
  expect(premoveNeedsPromotion(START, 'e2', 'e4')).toBe(false)
  expect(premoveUci({ from: 'e7', to: 'e8', promotion: 'q' })).toBe('e7e8q')
})
