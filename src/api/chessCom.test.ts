import { describe, expect, it, vi } from 'vitest'
import { parsePgn } from '../chess/parsePgn'
import {
  ChessComError,
  fetchJson,
  formatTimeControl,
  isReviewable,
  normalizeUsername,
  toGameSummary,
} from './chessCom'
import { chessComGame, jsonResponse } from './fixtures'

describe('toGameSummary', () => {
  it('đọc người chơi, kết quả, màu của người dùng (không phân biệt hoa/thường) và accuracy', () => {
    const s = toGameSummary(chessComGame(), 'hikaru')
    expect(s).toMatchObject({
      id: '8dda7510-d093-11f1-8cd7-777c7b01000f',
      white: { name: 'KodandaPrime', rating: 3144 },
      black: { name: 'Hikaru', rating: 3470 },
      result: '0-1',
      userColor: 'b',
      userOutcome: 'win',
      timeClass: 'blitz',
      chessComAccuracy: { w: 84.3, b: 87.31 },
    })
    expect(s.endTime.toISOString()).toBe('2026-10-25T16:51:46.000Z')
    expect(toGameSummary(chessComGame(), 'kodandaprime')).toMatchObject({ userColor: 'w', userOutcome: 'loss' })
  })

  it.each([
    ['agreed', 'draw'],
    ['repetition', 'draw'],
    ['stalemate', 'draw'],
    ['insufficient', 'draw'],
    ['50move', 'draw'],
    ['timevsinsufficient', 'draw'],
    ['timeout', 'loss'],
    ['resigned', 'loss'],
    ['abandoned', 'loss'],
  ])('result "%s" → %s', (code, outcome) => {
    const other = outcome === 'draw' ? code : 'win'
    const game = chessComGame({
      white: { username: 'A', rating: 1500, result: code },
      black: { username: 'B', rating: 1500, result: other },
    })
    const s = toGameSummary(game, 'a')
    expect(s.userOutcome).toBe(outcome)
    expect(s.result).toBe(outcome === 'draw' ? '1/2-1/2' : '0-1')
  })

  it('username không khớp bên nào (vd. đã đổi tên): mặc định Trắng, outcome suy từ result', () => {
    expect(toGameSummary(chessComGame(), 'old-name')).toMatchObject({ userColor: 'w', userOutcome: 'loss', result: '0-1' })
  })

  it('mã kết quả lạ ở cả hai bên: result và userOutcome cùng là hòa', () => {
    const game = chessComGame({
      white: { username: 'A', rating: 1500, result: 'weird' },
      black: { username: 'B', rating: 1500, result: 'weird' },
    })
    expect(toGameSummary(game, 'a')).toMatchObject({ result: '1/2-1/2', userOutcome: 'draw' })
  })

  it('ván chưa được review trên chess.com không có accuracy', () => {
    expect(toGameSummary(chessComGame({ accuracies: undefined }), 'hikaru').chessComAccuracy).toBeUndefined()
  })

  it('PGN của chess.com (có comment %clk) đọc được bằng parsePgn', () => {
    const parsed = parsePgn(chessComGame().pgn!)
    expect(parsed.ok && parsed.game.plies.map((p) => p.san)).toEqual(['Nf3', 'd5'])
  })
})

describe('isReviewable', () => {
  it('chỉ giữ cờ vua thường có PGN', () => {
    expect(isReviewable(chessComGame())).toBe(true)
    expect(isReviewable(chessComGame({ rules: 'chess960' }))).toBe(false)
    expect(isReviewable(chessComGame({ rules: 'kingofthehill' }))).toBe(false)
    expect(isReviewable(chessComGame({ pgn: undefined }))).toBe(false)
  })
})

describe('normalizeUsername', () => {
  it('cắt khoảng trắng, chữ thường; từ chối ký tự lạ', () => {
    expect(normalizeUsername('  Hikaru ')).toBe('hikaru')
    expect(normalizeUsername('magnus_carlsen-2')).toBe('magnus_carlsen-2')
    expect(() => normalizeUsername('ab')).toThrow(ChessComError)
    expect(() => normalizeUsername('a/b/../c')).toThrow(ChessComError)
  })
})

describe('formatTimeControl', () => {
  it.each([
    ['180', '3+0'],
    ['180+2', '3+2'],
    ['60+1', '1+1'],
    ['30', '½+0'],
    ['600+5', '10+5'],
    ['1/259200', '3 ngày/nước'],
  ])('%s → %s', (input, expected) => {
    expect(formatTimeControl(input)).toBe(expected)
  })
})

describe('fetchJson', () => {
  it('trả JSON khi 200', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ archives: [] }))
    await expect(fetchJson(fetchFn, 'u')).resolves.toEqual({ archives: [] })
  })

  it.each([
    [404, 'not-found'],
    [429, 'rate-limited'],
    [500, 'http'],
  ])('HTTP %i → %s', async (status, kind) => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, status))
    await expect(fetchJson(fetchFn, 'u')).rejects.toMatchObject({ kind })
  })

  it('404 của URL tháng là lỗi http (thử lại được), không phải "không có người chơi"', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 404))
    await expect(fetchJson(fetchFn, 'u', undefined, 'http')).rejects.toMatchObject({ kind: 'http' })
  })

  it('lỗi mạng → network; abort thì ném lại lỗi abort', async () => {
    await expect(fetchJson(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')), 'u')).rejects.toMatchObject({
      kind: 'network',
    })
    const controller = new AbortController()
    controller.abort()
    const abortError = new DOMException('aborted', 'AbortError')
    await expect(fetchJson(vi.fn().mockRejectedValue(abortError), 'u', controller.signal)).rejects.toBe(abortError)
  })
})
