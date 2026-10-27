import { describe, expect, it } from 'vitest'
import { toGameSummary } from '../api/chessCom'
import { chessComGame } from '../api/fixtures'
import { chessComListView, type ListViewInput } from './chessComListView'

const games = Array.from({ length: 25 }, (_, i) => toGameSummary(chessComGame({ uuid: `g${i}` }), 'hikaru'))

const view = (input: Partial<ListViewInput>) =>
  chessComListView({ status: 'ready', games, filtered: games, visible: 20, hasMore: true, error: null, ...input })

describe('chessComListView', () => {
  it('lần tải đầu: chỉ hiện "Đang tải"', () => {
    expect(view({ status: 'loading', games: [], filtered: [] })).toEqual({
      shown: [],
      message: 'Đang tải ván…',
      showMoreButton: false,
      searchOlderButton: false,
    })
  })

  it('có ván: hiện một trang và nút "Tải thêm"', () => {
    const v = view({})
    expect(v.shown).toHaveLength(20)
    expect(v).toMatchObject({ message: null, showMoreButton: true, searchOlderButton: false })
  })

  it('đã hiện hết và hết tháng: không còn nút', () => {
    expect(view({ visible: 40, hasMore: false })).toMatchObject({ showMoreButton: false, searchOlderButton: false })
  })

  it('lượt đầu không có ván review được nhưng còn tháng cũ: có thông báo và nút tìm tiếp', () => {
    expect(view({ games: [], filtered: [] })).toMatchObject({
      message: 'Chưa thấy ván cờ vua thường nào trong các tháng gần đây.',
      searchOlderButton: true,
    })
  })

  it('bộ lọc không khớp ván nào đã tải: gợi ý tìm tháng cũ hơn', () => {
    expect(view({ filtered: [] })).toMatchObject({ message: 'Chưa thấy ván phù hợp trong các tháng đã tìm.', searchOlderButton: true })
    expect(view({ filtered: [], hasMore: false })).toMatchObject({ message: 'Không có ván nào phù hợp.', searchOlderButton: false })
  })

  it('đang lỗi: không hiện nút tải (nút Thử lại do lỗi quyết định)', () => {
    expect(view({ status: 'error', error: 'x' })).toMatchObject({ showMoreButton: false, searchOlderButton: false, message: null })
  })
})
