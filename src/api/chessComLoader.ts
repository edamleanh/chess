import {
  archivesUrl,
  ChessComError,
  fetchJson,
  isReviewable,
  toGameSummary,
  type ChessComGame,
  type FetchFn,
  type GameSummary,
} from './chessCom'

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((s) => typeof s === 'string')
}

/** Mỗi lượt "tải thêm" gom ít nhất chừng này ván (nếu còn). */
export const PAGE_SIZE = 20
/** Không đọc quá chừng này tháng trong một lượt, để người chơi ít ván không phải chờ lâu. */
const MAX_MONTHS_PER_LOAD = 6

/**
 * Tải ván của một người chơi chess.com, từ tháng mới nhất về trước.
 * Gọi API tuần tự (chess.com khuyến nghị không gọi song song).
 */
export class ChessComLoader {
  readonly username: string
  /** Mọi ván đã tải, mới nhất trước. */
  games: GameSummary[] = []
  private archives: string[] | null = null
  private nextMonth = -1
  private readonly fetchFn: FetchFn
  private readonly signal?: AbortSignal

  constructor(username: string, fetchFn: FetchFn, signal?: AbortSignal) {
    this.username = username
    this.fetchFn = fetchFn
    this.signal = signal
  }

  get hasMore(): boolean {
    return this.archives === null || this.nextMonth >= 0
  }

  /** Tháng cũ nhất đã tải, dạng "MM/YYYY"; null khi chưa tải tháng nào. */
  get oldestLoadedMonth(): string | null {
    if (!this.archives || this.nextMonth === this.archives.length - 1) return null
    const match = this.archives[this.nextMonth + 1].match(/(\d{4})\/(\d{2})$/)
    return match ? `${match[2]}/${match[1]}` : null
  }

  /**
   * Tải thêm cho tới khi có thêm ít nhất PAGE_SIZE ván khớp `match` (mặc định: mọi ván),
   * hoặc đã đọc đủ số tháng cho một lượt, hoặc hết archive. Trả về toàn bộ ván đã tải.
   */
  async loadMore(match: (game: GameSummary) => boolean = () => true): Promise<GameSummary[]> {
    if (this.archives === null) {
      const body = await fetchJson<{ archives?: unknown }>(this.fetchFn, archivesUrl(this.username), this.signal)
      if (!isStringArray(body.archives)) throw new ChessComError('http')
      const archives = body.archives
      this.archives = archives
      this.nextMonth = archives.length - 1 // archives xếp cũ → mới
    }

    let added = 0
    for (let months = 0; months < MAX_MONTHS_PER_LOAD && added < PAGE_SIZE && this.nextMonth >= 0; months++) {
      const url = this.archives[this.nextMonth]
      const body = await fetchJson<{ games?: unknown }>(this.fetchFn, url, this.signal, 'http')
      if (!Array.isArray(body.games)) throw new ChessComError('http')
      const games = body.games as ChessComGame[]
      // Chỉ lùi con trỏ khi tải tháng thành công, để lỗi giữa chừng có thể thử lại đúng tháng đó
      this.nextMonth--
      const summaries = games
        .filter(isReviewable)
        .map((g) => toGameSummary(g, this.username))
        .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())
      this.games = [...this.games, ...summaries]
      added += summaries.filter(match).length
    }
    return this.games
  }
}
