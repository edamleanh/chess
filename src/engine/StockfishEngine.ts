import type { EngineTransport } from './transport'
import { parseBestMove, parseInfo, toWhitePov, type EngineInfo } from './uci'

export interface SearchLimits {
  movetimeMs: number
  maxDepth: number
  /** Số biến chính cần tính (mặc định 1). */
  multiPv?: number
}

/**
 * Vị trí cần phân tích. Có `moves` thì gửi `position fen <startFen> moves ...` để engine biết lịch sử
 * (nhận ra lặp 3 lần); `fen` luôn là vị trí cuối, dùng để đổi score về góc nhìn Trắng.
 */
export interface EnginePosition {
  fen: string
  startFen?: string
  moves?: string[]
}

export interface SearchResult {
  /** Search bị hủy (do có search mới, stop(), terminate() hoặc engine lỗi) trước khi kết thúc. */
  cancelled: boolean
  /** Nước tốt nhất dạng UCI, null nếu không có nước hợp lệ hoặc bị hủy. */
  bestMove: string | null
  /** Info cuối cùng có score chính xác (multipv 1, không phải bound), theo góc nhìn Trắng. */
  lastInfo: EngineInfo | null
  /** Info chính xác cuối cùng của từng biến: lines[0] là multipv 1, lines[1] là multipv 2... */
  lines: EngineInfo[]
}

/** `info.score` luôn theo góc nhìn Trắng. */
export type InfoListener = (info: EngineInfo) => void

interface Search {
  position: EnginePosition
  limits: SearchLimits
  onInfo: InfoListener
  resolve: (result: SearchResult) => void
  /** Đã gửi `stop`. Bỏ qua mọi info còn lại và coi kết quả là bị hủy. */
  stopping: boolean
  lines: EngineInfo[]
}

export interface EngineOptions {
  threads: number
  hashMb: number
}

export const CANCELLED: SearchResult = { cancelled: true, bestMove: null, lastInfo: null, lines: [] }

export function positionCommand(position: EnginePosition): string {
  if (position.startFen && position.moves && position.moves.length > 0) {
    return `position fen ${position.startFen} moves ${position.moves.join(' ')}`
  }
  return `position fen ${position.fen}`
}

/**
 * Bọc một engine UCI. Mỗi lúc chỉ chạy một search. Có search mới thì search cũ bị `stop`,
 * và chỉ giữ yêu cầu mới nhất trong hàng đợi.
 */
export class StockfishEngine {
  /** Gọi khi Worker lỗi sau khi đã khởi động xong; engine coi như đã terminate. */
  onCrash: ((message: string) => void) | null = null

  private current: Search | null = null
  private queued: Search | null = null
  private waiters: { expect: string; resolve: () => void }[] = []
  private idleWaiters: (() => void)[] = []
  private initFailure: ((message: string) => void) | null = null
  private terminated = false
  private multiPv = 1
  private readonly transport: EngineTransport
  private readonly options: EngineOptions

  constructor(transport: EngineTransport, options: EngineOptions) {
    this.transport = transport
    this.options = options
    transport.onLine = (line) => this.handleLine(line)
    transport.onError = (message) => this.handleError(message)
  }

  /** Khởi tạo UCI và cấu hình. Reject khi Worker lỗi hoặc quá thời gian. */
  async init(timeoutMs: number): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const failed = new Promise<never>((_, reject) => {
      this.initFailure = (message) => reject(new Error(message))
      timer = setTimeout(() => reject(new Error('Hết thời gian chờ engine khởi động')), timeoutMs)
    })
    const ready = (async () => {
      const uciok = this.waitFor('uciok')
      this.transport.send('uci')
      await uciok
      this.transport.send(`setoption name Threads value ${this.options.threads}`)
      this.transport.send(`setoption name Hash value ${this.options.hashMb}`)
      this.transport.send(`setoption name MultiPV value ${this.multiPv}`)
      const readyok = this.waitFor('readyok')
      this.transport.send('isready')
      await readyok
    })()
    try {
      await Promise.race([ready, failed])
    } finally {
      clearTimeout(timer)
      this.initFailure = null
    }
  }

  /**
   * Bắt đầu ván mới: dừng search hiện tại, xóa hash (`ucinewgame`) và chờ engine sẵn sàng.
   * Không chờ quá `timeoutMs`: ucinewgame chỉ để kết quả tái lập tốt hơn, không đáng để treo cả batch.
   */
  async newGame(timeoutMs = 10_000): Promise<void> {
    this.stop()
    await this.whenIdle()
    if (this.terminated) return
    const readyok = this.waitFor('readyok')
    this.transport.send('ucinewgame')
    this.transport.send('isready')
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([readyok, new Promise<void>((resolve) => (timer = setTimeout(resolve, timeoutMs)))])
    clearTimeout(timer)
  }

  analyze(position: EnginePosition, limits: SearchLimits, onInfo: InfoListener): Promise<SearchResult> {
    return new Promise((resolve) => {
      if (this.terminated) return resolve(CANCELLED)
      const search: Search = { position, limits, onInfo, resolve, stopping: false, lines: [] }
      if (!this.current) return this.start(search)

      this.queued?.resolve(CANCELLED)
      this.queued = search
      this.stopCurrent()
    })
  }

  /** Dừng search đang chạy và bỏ yêu cầu đang chờ. */
  stop(): void {
    this.queued?.resolve(CANCELLED)
    this.queued = null
    this.stopCurrent()
  }

  terminate(): void {
    if (this.terminated) return
    this.terminated = true
    this.stop()
    this.current?.resolve(CANCELLED)
    this.current = null
    // Không còn phản hồi nào nữa: giải phóng mọi chỗ đang chờ
    this.waiters.forEach((w) => w.resolve())
    this.waiters = []
    this.notifyIdle()
    this.transport.onLine = null
    this.transport.onError = null
    this.transport.terminate()
  }

  private start(search: Search) {
    this.current = search
    const multiPv = search.limits.multiPv ?? 1
    if (multiPv !== this.multiPv) {
      this.multiPv = multiPv
      this.transport.send(`setoption name MultiPV value ${multiPv}`)
    }
    this.transport.send(positionCommand(search.position))
    this.transport.send(`go depth ${search.limits.maxDepth} movetime ${search.limits.movetimeMs}`)
  }

  private stopCurrent() {
    if (!this.current || this.current.stopping) return
    this.current.stopping = true
    this.transport.send('stop')
  }

  private waitFor(expect: string): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ expect, resolve }))
  }

  private whenIdle(): Promise<void> {
    if (!this.current) return Promise.resolve()
    return new Promise((resolve) => this.idleWaiters.push(resolve))
  }

  private notifyIdle() {
    const waiters = this.idleWaiters
    this.idleWaiters = []
    waiters.forEach((resolve) => resolve())
  }

  private handleError(message: string) {
    if (this.initFailure) return this.initFailure(message)
    // Lỗi lúc đang chạy (vd. hết bộ nhớ): không bao giờ có bestmove nữa, phải hủy mọi search đang treo.
    const onCrash = this.onCrash
    this.terminate()
    onCrash?.(message)
  }

  private handleLine(line: string) {
    const waiter = this.waiters.find((w) => w.expect === line.trim())
    if (waiter) {
      this.waiters = this.waiters.filter((w) => w !== waiter)
      waiter.resolve()
      return
    }

    const search = this.current
    if (!search) return

    const bestMove = parseBestMove(line)
    if (bestMove !== undefined) {
      this.current = null
      // lastInfo phải đúng là biến 1; thiếu biến 1 thì coi như chưa có kết quả
      const lastInfo = search.lines[0] ?? null
      const lines = lastInfo ? search.lines.filter(Boolean) : []
      search.resolve(search.stopping ? CANCELLED : { cancelled: false, bestMove, lastInfo, lines })
      const next = this.queued
      this.queued = null
      if (next) this.start(next)
      else this.notifyIdle()
      return
    }

    if (search.stopping) return
    const raw = parseInfo(line)
    if (!raw) return
    const info = { ...raw, score: toWhitePov(raw.score, search.position.fen) }
    if (!info.bound) search.lines[info.multipv - 1] = info
    search.onInfo(info)
  }
}
