import { describe, expect, it, vi } from 'vitest'
import { archivesUrl } from './chessCom'
import { ChessComLoader, PAGE_SIZE } from './chessComLoader'
import { chessComGame, jsonResponse } from './fixtures'

const month = (m: number) => `https://api.chess.com/pub/player/hikaru/games/2026/${String(m).padStart(2, '0')}`

/** n ván trong tháng m, end_time tăng dần (API trả theo thứ tự thời gian). */
function gamesOf(m: number, n: number) {
  return Array.from({ length: n }, (_, i) =>
    chessComGame({ uuid: `${m}-${i}`, url: `u-${m}-${i}`, end_time: 1_790_000_000 + m * 100_000 + i }),
  )
}

function fakeApi(months: Record<number, unknown[]>) {
  const urls: string[] = []
  const fetchFn = vi.fn(async (url: string, _init?: RequestInit) => {
    urls.push(url)
    if (url === archivesUrl('hikaru')) return jsonResponse({ archives: Object.keys(months).map((m) => month(+m)) })
    const m = Object.keys(months).find((k) => month(+k) === url)
    return m ? jsonResponse({ games: months[+m] }) : jsonResponse({}, 404)
  })
  return { fetchFn, urls }
}

describe('ChessComLoader', () => {
  it('tải tháng mới nhất trước, ván mới nhất trước', async () => {
    const { fetchFn, urls } = fakeApi({ 9: gamesOf(9, 3), 10: gamesOf(10, 25) })
    const loader = new ChessComLoader('hikaru', fetchFn)
    const games = await loader.loadMore()

    expect(urls).toEqual([archivesUrl('hikaru'), month(10)]) // 25 ván ≥ PAGE_SIZE: chưa cần tháng 9
    expect(games).toHaveLength(25)
    expect(games[0].id).toBe('10-24')
    expect(loader.hasMore).toBe(true)
  })

  it('gom qua nhiều tháng cho đủ một trang, bỏ qua tháng rỗng và ván biến thể', async () => {
    const { fetchFn, urls } = fakeApi({
      7: gamesOf(7, 30),
      8: [chessComGame({ rules: 'chess960' })],
      9: [],
      10: gamesOf(10, 5),
    })
    const loader = new ChessComLoader('hikaru', fetchFn)
    const games = await loader.loadMore()

    expect(urls.slice(1)).toEqual([month(10), month(9), month(8), month(7)])
    expect(games).toHaveLength(35)
    expect(games.map((g) => g.id).slice(4, 6)).toEqual(['10-0', '7-29'])
    expect(loader.hasMore).toBe(false)
  })

  it('lần tải sau nối tiếp, không trùng ván', async () => {
    const { fetchFn } = fakeApi({ 9: gamesOf(9, PAGE_SIZE), 10: gamesOf(10, PAGE_SIZE) })
    const loader = new ChessComLoader('hikaru', fetchFn)
    await loader.loadMore()
    const games = await loader.loadMore()
    expect(games).toHaveLength(2 * PAGE_SIZE)
    expect(new Set(games.map((g) => g.id)).size).toBe(2 * PAGE_SIZE)
    expect(loader.hasMore).toBe(false)
  })

  it('đếm theo ván khớp bộ lọc: tìm qua nhiều tháng cho tới khi đủ ván Rapid', async () => {
    const rapid = (m: number, n: number) => gamesOf(m, n).map((g) => ({ ...g, time_class: 'rapid' }))
    const { fetchFn, urls } = fakeApi({ 7: rapid(7, 25), 8: gamesOf(8, 30), 9: gamesOf(9, 30), 10: gamesOf(10, 30) })
    const loader = new ChessComLoader('hikaru', fetchFn)
    const games = await loader.loadMore((g) => g.timeClass === 'rapid')
    expect(urls.slice(1)).toEqual([month(10), month(9), month(8), month(7)])
    expect(games.filter((g) => g.timeClass === 'rapid')).toHaveLength(25)
    expect(loader.oldestLoadedMonth).toBe('07/2026')
  })

  it('oldestLoadedMonth: null khi chưa tải tháng nào', async () => {
    const { fetchFn } = fakeApi({ 10: gamesOf(10, 30) })
    const loader = new ChessComLoader('hikaru', fetchFn)
    expect(loader.oldestLoadedMonth).toBeNull()
    await loader.loadMore()
    expect(loader.oldestLoadedMonth).toBe('10/2026')
  })

  it('username không tồn tại → ChessComError not-found', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ code: 0, message: 'User "x" not found.' }, 404))
    await expect(new ChessComLoader('nobody123', fetchFn).loadMore()).rejects.toMatchObject({ kind: 'not-found' })
  })

  it('lỗi giữa chừng: lần thử lại tải lại đúng tháng bị lỗi', async () => {
    let fail = true
    const fetchFn = vi.fn(async (url: string) => {
      if (url === archivesUrl('hikaru')) return jsonResponse({ archives: [month(9), month(10)] })
      if (url === month(10) && fail) {
        fail = false
        return jsonResponse({}, 429)
      }
      return jsonResponse({ games: gamesOf(url === month(10) ? 10 : 9, 3) })
    })
    const loader = new ChessComLoader('hikaru', fetchFn)
    await expect(loader.loadMore()).rejects.toMatchObject({ kind: 'rate-limited' })
    const games = await loader.loadMore()
    expect(games.map((g) => g.id)[0]).toBe('10-2')
    expect(games).toHaveLength(6)
  })

  it('dữ liệu sai dạng → lỗi http, lần thử lại tải lại archives', async () => {
    let broken = true
    const fetchFn = vi.fn(async (url: string) => {
      if (url === archivesUrl('hikaru')) {
        if (broken) {
          broken = false
          return jsonResponse({ unexpected: true })
        }
        return jsonResponse({ archives: [month(10)] })
      }
      return jsonResponse({ games: gamesOf(10, 2) })
    })
    const loader = new ChessComLoader('hikaru', fetchFn)
    await expect(loader.loadMore()).rejects.toMatchObject({ kind: 'http' })
    await expect(loader.loadMore()).resolves.toHaveLength(2)
  })

  it('tháng bị 404 → lỗi http (thử lại được)', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url === archivesUrl('hikaru') ? jsonResponse({ archives: [month(10)] }) : jsonResponse({}, 404),
    )
    await expect(new ChessComLoader('hikaru', fetchFn).loadMore()).rejects.toMatchObject({ kind: 'http' })
  })

  it('truyền AbortSignal cho fetch', async () => {
    const { fetchFn } = fakeApi({ 10: gamesOf(10, 1) })
    const controller = new AbortController()
    await new ChessComLoader('hikaru', fetchFn, controller.signal).loadMore()
    expect(fetchFn.mock.calls.every(([, init]) => init?.signal === controller.signal)).toBe(true)
  })
})
