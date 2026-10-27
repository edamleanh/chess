import type { Color } from '../types'

// API công khai của chess.com (không cần đăng nhập): https://www.chess.com/news/view/published-data-api

/** Các trường đang dùng của một ván trong `GET /pub/player/{user}/games/{yyyy}/{mm}`. */
export interface ChessComGame {
  url: string
  uuid?: string
  pgn?: string
  end_time: number
  time_class: string
  time_control: string
  rated: boolean
  rules: string
  accuracies?: { white: number; black: number }
  white: ChessComPlayer
  black: ChessComPlayer
}

interface ChessComPlayer {
  username: string
  rating: number
  result: string
}

export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily'

export const TIME_CLASS_LABEL: Record<TimeClass, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  daily: 'Daily',
}

export function timeClassLabel(timeClass: string): string {
  return TIME_CLASS_LABEL[timeClass as TimeClass] ?? (timeClass || 'Khác')
}

export interface GameSummary {
  id: string
  url: string
  pgn: string
  endTime: Date
  timeClass: string
  timeControl: string
  rated: boolean
  white: { name: string; rating: number }
  black: { name: string; rating: number }
  result: '1-0' | '0-1' | '1/2-1/2'
  /** Màu của người chơi đang được tìm (so khớp username không phân biệt hoa/thường). */
  userColor: Color
  userOutcome: 'win' | 'loss' | 'draw'
  /** Accuracy do chess.com tính (chỉ có với ván đã được review trên chess.com). */
  chessComAccuracy?: Record<Color, number>
}

export type ChessComErrorKind = 'invalid' | 'not-found' | 'rate-limited' | 'network' | 'http'

const ERROR_MESSAGES: Record<ChessComErrorKind, string> = {
  invalid: 'Username không hợp lệ (3–25 ký tự: chữ, số, "_" hoặc "-").',
  'not-found': 'Không tìm thấy người chơi này trên chess.com.',
  'rate-limited': 'chess.com đang giới hạn số lần gọi. Đợi một lát rồi thử lại.',
  network: 'Không kết nối được tới chess.com. Kiểm tra mạng rồi thử lại.',
  http: 'chess.com trả về lỗi. Thử lại sau.',
}

export class ChessComError extends Error {
  readonly kind: ChessComErrorKind
  constructor(kind: ChessComErrorKind) {
    super(ERROR_MESSAGES[kind])
    this.name = 'ChessComError'
    this.kind = kind
  }
}

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,25}$/

export function normalizeUsername(input: string): string {
  const username = input.trim().toLowerCase()
  if (!USERNAME_PATTERN.test(username)) throw new ChessComError('invalid')
  return username
}

export function archivesUrl(username: string): string {
  return `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`
}

/** Chỉ review được cờ vua thường có PGN (bỏ chess960 và các biến thể). */
export function isReviewable(game: ChessComGame): boolean {
  return game.rules === 'chess' && typeof game.pgn === 'string' && game.pgn.length > 0
}

/**
 * Kết quả ván theo result code của hai bên: bên có `win` thắng; không bên nào `win` mà có bên mang mã hòa thì hòa.
 * Mã lạ (không win, không hòa) ở cả hai bên: coi là hòa vì không xác định được người thắng.
 */
function gameResult(game: ChessComGame): GameSummary['result'] {
  if (game.white.result === 'win') return '1-0'
  if (game.black.result === 'win') return '0-1'
  return '1/2-1/2'
}

export function toGameSummary(game: ChessComGame, username: string): GameSummary {
  // Không khớp bên nào (vd. dữ liệu cũ trước khi đổi tên tài khoản): mặc định Trắng
  const userColor: Color = game.black.username.toLowerCase() === username.toLowerCase() ? 'b' : 'w'
  const result = gameResult(game)
  // Suy từ result để hai trường luôn nhất quán
  const userOutcome =
    result === '1/2-1/2' ? 'draw' : (result === '1-0') === (userColor === 'w') ? 'win' : 'loss'

  return {
    id: game.uuid ?? game.url,
    url: game.url,
    pgn: game.pgn ?? '',
    endTime: new Date(game.end_time * 1000),
    timeClass: game.time_class,
    timeControl: game.time_control,
    rated: game.rated,
    white: { name: game.white.username, rating: game.white.rating },
    black: { name: game.black.username, rating: game.black.rating },
    result,
    userColor,
    userOutcome,
    chessComAccuracy: game.accuracies ? { w: game.accuracies.white, b: game.accuracies.black } : undefined,
  }
}

/** "180" → "3+0", "180+2" → "3+2", "60+1" → "1+1", "30" → "½+0", "1/259200" → "3 ngày/nước". */
export function formatTimeControl(timeControl: string): string {
  const daily = timeControl.match(/^1\/(\d+)$/)
  if (daily) return `${Math.round(Number(daily[1]) / 86400)} ngày/nước`
  const [base, increment = '0'] = timeControl.split('+')
  const seconds = Number(base)
  if (Number.isNaN(seconds)) return timeControl
  const minutes = seconds / 60
  const label = minutes === 0.5 ? '½' : Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1)
  return `${label}+${increment}`
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

/**
 * Gọi API, đổi lỗi HTTP/mạng thành ChessComError. Lỗi abort được ném lại nguyên trạng.
 * `notFound`: 404 nghĩa là gì. Với URL người chơi là "không có người chơi"; với URL tháng chỉ là lỗi HTTP (thử lại được).
 */
export async function fetchJson<T>(
  fetchFn: FetchFn,
  url: string,
  signal?: AbortSignal,
  notFound: 'not-found' | 'http' = 'not-found',
): Promise<T> {
  let res: Response
  try {
    res = await fetchFn(url, { signal })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new ChessComError('network')
  }
  if (res.status === 404) throw new ChessComError(notFound)
  if (res.status === 429) throw new ChessComError('rate-limited')
  if (!res.ok) throw new ChessComError('http')
  return (await res.json()) as T
}
