import { engineOptions, FLAVORS, flavorUrl, poolSize, type FlavorId } from './flavors'
import { CANCELLED, StockfishEngine, type EnginePosition, type SearchLimits, type SearchResult } from './StockfishEngine'
import type { EngineTransport } from './transport'

export type PoolFlavor = 'full-single' | 'lite-single'

export interface PoolEnv {
  cores: number
  deviceMemoryGb?: number
  baseUrl: string
  createTransport: (url: string) => EngineTransport
}

export interface PoolStatus {
  flavor: PoolFlavor | null
  /** Số engine đã sẵn sàng. */
  ready: number
  /** Số engine đang khởi động. */
  starting: number
  /** Không còn engine nào chạy được (kể cả bản dự phòng). */
  failed: boolean
}

interface Job {
  position: EnginePosition
  limits: SearchLimits
  resolve: (result: SearchResult) => void
  attempts: number
}

/** Một vị trí được thử tối đa chừng này lần khi engine đang phân tích nó bị crash. */
const MAX_ATTEMPTS = 3

/**
 * Nhiều engine Stockfish 1 luồng chạy song song, mỗi engine phân tích một vị trí (hàng đợi FIFO).
 * Dùng cho phân tích cả ván: các vị trí độc lập nhau nên chia việc hiệu quả hơn một engine nhiều luồng.
 * Engine nào sẵn sàng là nhận việc ngay; không khởi động được bản Full nào thì tự chuyển sang Lite.
 */
export class EnginePool {
  private engines: StockfishEngine[] = []
  private idle: StockfishEngine[] = []
  private queue: Job[] = []
  private terminated = false
  private status: PoolStatus = { flavor: null, ready: 0, starting: 0, failed: false }
  private readonly env: PoolEnv
  private readonly onStatus: (status: PoolStatus) => void

  private readonly maxEngines: number

  /** `maxEngines`: giới hạn số engine (vd. pool nhỏ cho biến phụ chạy song song với phân tích live). */
  constructor(
    env: PoolEnv,
    preferred: PoolFlavor,
    onStatus: (status: PoolStatus) => void = () => {},
    maxEngines = Infinity,
  ) {
    this.env = env
    this.onStatus = onStatus
    this.maxEngines = maxEngines
    const fullSize = preferred === 'full-single' ? poolSize('full-single', env.cores, env.deviceMemoryGb) : 0
    // Khởi động ở microtask kế tiếp: onStatus không bị gọi đồng bộ trong constructor (vd. trong effect của React)
    queueMicrotask(() => {
      if (!this.terminated) this.boot(fullSize > 0 ? 'full-single' : 'lite-single')
    })
  }

  getStatus(): PoolStatus {
    return this.status
  }

  analyze(position: EnginePosition, limits: SearchLimits): Promise<SearchResult> {
    return new Promise((resolve) => {
      if (this.terminated || this.status.failed) return resolve(CANCELLED)
      this.queue.push({ position, limits, resolve, attempts: 0 })
      this.pump()
    })
  }

  terminate(): void {
    if (this.terminated) return
    this.terminated = true
    this.failQueue()
    this.engines.forEach((e) => e.terminate())
    this.engines = []
    this.idle = []
  }

  private boot(flavor: PoolFlavor) {
    const size = Math.min(poolSize(flavor, this.env.cores, this.env.deviceMemoryGb), this.maxEngines)
    const def = FLAVORS[flavor]
    const options = engineOptions(def, this.env.cores, this.env.deviceMemoryGb)
    this.setStatus({ flavor, starting: size })

    for (let i = 0; i < size; i++) {
      const engine = new StockfishEngine(this.env.createTransport(flavorUrl(def, this.env.baseUrl)), options)
      engine.init(def.initTimeoutMs).then(
        () => {
          this.setStatus({ starting: this.status.starting - 1 })
          if (this.terminated) return engine.terminate()
          engine.onCrash = () => this.remove(engine)
          this.engines.push(engine)
          this.idle.push(engine)
          this.setStatus({ ready: this.engines.length })
          this.pump()
        },
        () => {
          engine.terminate()
          this.setStatus({ starting: this.status.starting - 1 })
          this.checkExhausted()
        },
      )
    }
  }

  private pump() {
    while (!this.terminated && this.idle.length > 0 && this.queue.length > 0) {
      const engine = this.idle.pop()!
      const job = this.queue.shift()!
      this.run(engine, job)
    }
  }

  private run(engine: StockfishEngine, job: Job) {
    job.attempts++
    void engine.analyze(job.position, job.limits, () => {}).then((result) => {
      if (this.terminated) return job.resolve(CANCELLED)
      if (result.cancelled && !this.engines.includes(engine)) {
        // Engine crash giữa chừng: giao vị trí cho engine khác
        if (job.attempts < MAX_ATTEMPTS) this.queue.unshift(job)
        else job.resolve(CANCELLED)
        this.checkExhausted()
        this.pump()
        return
      }
      job.resolve(result)
      this.idle.push(engine)
      this.pump()
    })
  }

  private remove(engine: StockfishEngine) {
    this.engines = this.engines.filter((e) => e !== engine)
    this.idle = this.idle.filter((e) => e !== engine)
    this.setStatus({ ready: this.engines.length })
    this.checkExhausted()
  }

  /** Hết engine và không còn engine nào đang khởi động: chuyển sang Lite, hoặc báo thất bại. */
  private checkExhausted() {
    if (this.terminated || this.engines.length > 0 || this.status.starting > 0) return
    if (this.status.flavor === 'full-single') return this.boot('lite-single')
    this.setStatus({ failed: true })
    this.failQueue()
  }

  private failQueue() {
    const queue = this.queue
    this.queue = []
    queue.forEach((job) => job.resolve(CANCELLED))
  }

  private setStatus(patch: Partial<PoolStatus>) {
    this.status = { ...this.status, ...patch }
    this.onStatus(this.status)
  }
}

export function poolLabel(flavor: FlavorId | null): string {
  return flavor ? FLAVORS[flavor].label : 'Stockfish'
}
