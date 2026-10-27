import type { ChessComGame } from './chessCom'

/** Ván chess.com rút gọn từ dữ liệu thật (API /pub/player/hikaru/games/2026/10), dùng cho test. */
export function chessComGame(overrides: Partial<ChessComGame> = {}): ChessComGame {
  return {
    url: 'https://www.chess.com/game/live/185932492614',
    uuid: '8dda7510-d093-11f1-8cd7-777c7b01000f',
    pgn: '[Event "Live Chess"]\n[White "KodandaPrime"]\n[Black "Hikaru"]\n[Result "0-1"]\n\n1. Nf3 {[%clk 0:03:00]} 1... d5 {[%clk 0:02:59.9]} 0-1',
    end_time: 1792947106,
    time_class: 'blitz',
    time_control: '180',
    rated: true,
    rules: 'chess',
    accuracies: { white: 84.3, black: 87.31 },
    white: { username: 'KodandaPrime', rating: 3144, result: 'checkmated' },
    black: { username: 'Hikaru', rating: 3470, result: 'win' },
    ...overrides,
  }
}

/** Response giả cho fetch. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
