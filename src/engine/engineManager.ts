import { engineOptions, FLAVORS, flavorUrl, pickFlavors, type FlavorId } from './flavors'
import {
  CANCELLED,
  StockfishEngine,
  type EnginePosition,
  type InfoListener,
  type SearchLimits,
  type SearchResult,
} from './StockfishEngine'
import { workerTransport, type EngineTransport } from './transport'

export interface EngineStatus {
  /** Bản đang phân tích; null khi chưa khởi động xong. */
  flavor: FlavorId | null
  threads: number
  /** Đang tải bản Full ở nền. */
  loadingFull: boolean
  error: string | null
}

interface Request {
  position: EnginePosition
  limits: SearchLimits
  onInfo: InfoListener
  resolve: (result: SearchResult) => void
  token?: object
}

export interface ManagerEnv {
  crossOriginIsolated: boolean
  cores: number
  deviceMemoryGb?: number
  baseUrl: string
  createTransport: (url: string) => EngineTransport
}

/**
 * Engine cho phân tích **live** (vị trí đang xem): chạy bản bridge (Lite) ngay, tải bản Full đa luồng ở nền
 * rồi chuyển sang khi sẵn sàng. Phân tích cả ván chạy riêng trên EnginePool; trong lúc đó live bị tạm dừng
 * qua `holdLive()` để hai bên không tranh CPU.
 */
export class EngineManager {
  private active: StockfishEngine | null = null
  /** Yêu cầu live gần nhất chưa xong. Được chạy lại khi đổi engine hoặc khi hết bị giữ. */
  private pending: Request | null = null
  /** Số nơi đang giữ (tạm dừng) phân tích live. */
  private holds = 0
  private status: EngineStatus = { flavor: null, threads: 0, loadingFull: false, error: null }
  private listeners = new Set<() => void>()
  private started = false
  private bridge: FlavorId | null = null
  private readonly env: ManagerEnv

  constructor(env: ManagerEnv) {
    this.env = env
  }

  getStatus = (): EngineStatus => this.status

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    if (this.started) return
    this.started = true
    const { bridge, target } = pickFlavors(this.env.crossOriginIsolated)
    this.bridge = bridge
    this.setStatus({ loadingFull: target !== null })

    const boots = [this.boot(bridge)]
    if (target) boots.push(this.boot(target).finally(() => this.setStatus({ loadingFull: false })))
    void Promise.all(boots).then(() => this.failIfNoEngine('Không khởi động được engine'))
  }

  /** Phân tích live: chỉ giữ yêu cầu mới nhất; bị hoãn khi đang bị giữ. */
  analyze(position: EnginePosition, limits: SearchLimits, onInfo: InfoListener): Promise<SearchResult> {
    return new Promise((resolve) => {
      this.pending?.resolve(CANCELLED)
      const request: Request = { position, limits, onInfo, resolve }
      this.pending = request
      this.run(request)
    })
  }

  /** Dừng phân tích live. */
  stop(): void {
    this.pending?.resolve(CANCELLED)
    this.pending = null
    if (this.holds === 0) this.active?.stop()
  }

  /**
   * Tạm dừng phân tích live (vd. trong lúc phân tích cả ván, để nhường CPU). Yêu cầu live vẫn được giữ
   * và tự chạy lại khi mọi nơi giữ đã gọi hàm trả về.
   */
  holdLive(): () => void {
    this.holds++
    if (this.holds === 1) this.active?.stop()
    let released = false
    return () => {
      if (released) return
      released = true
      this.holds--
      if (this.holds === 0 && this.pending) this.run(this.pending)
    }
  }

  private run(request: Request) {
    const engine = this.active
    if (!engine || this.holds > 0) return // chạy khi có engine sẵn sàng và không bị giữ
    // Token cho lần chạy này: kết quả của lần chạy cũ (bị thay bởi lần chạy lại) không được resolve request
    const token = {}
    request.token = token
    void engine.analyze(request.position, request.limits, request.onInfo).then((result) => {
      if (this.pending !== request || request.token !== token) return
      // Bị hủy do đổi engine/crash hoặc do bị giữ: yêu cầu sẽ được chạy lại sau
      if (result.cancelled && (engine !== this.active || this.holds > 0)) return
      this.pending = null
      request.resolve(result)
    })
  }

  private failIfNoEngine(error: string) {
    if (this.active) return
    this.setStatus({ flavor: null, threads: 0, error })
    this.pending?.resolve(CANCELLED)
    this.pending = null
  }

  /** Engine đang dùng bị lỗi lúc chạy: bỏ nó, quay về bản bridge nếu engine lỗi là bản Full. */
  private handleCrash(id: FlavorId, message: string) {
    this.active = null
    this.setStatus({ flavor: null, threads: 0 })
    const error = `Engine gặp lỗi: ${message}`
    // Bản Lite lỗi trong lúc bản Full đang tải: chờ Full, chưa phải hết engine
    // (nếu Full cũng lỗi, start() sẽ báo lỗi sau khi mọi bản đều khởi động xong)
    if (id !== 'full' && this.status.loadingFull) return
    if (id === 'full' && this.bridge) {
      void this.boot(this.bridge).then(() => this.failIfNoEngine(error))
    } else {
      this.failIfNoEngine(error)
    }
  }

  /** Khởi động một bản engine. Thành công thì dùng nó thay engine hiện tại (trừ khi bản Full đã chạy). */
  private async boot(id: FlavorId): Promise<void> {
    const flavor = FLAVORS[id]
    const options = engineOptions(flavor, this.env.cores, this.env.deviceMemoryGb)
    const engine = new StockfishEngine(this.env.createTransport(flavorUrl(flavor, this.env.baseUrl)), options)
    try {
      await engine.init(flavor.initTimeoutMs)
    } catch {
      engine.terminate()
      return
    }
    if (this.status.flavor === 'full') {
      engine.terminate() // bridge khởi động xong sau Full: không cần nữa
      return
    }

    const previous = this.active
    this.active = engine
    engine.onCrash = (message) => {
      if (this.active === engine) this.handleCrash(id, message)
    }
    this.setStatus({ flavor: id, threads: options.threads, error: null })
    previous?.terminate()
    if (this.pending) this.run(this.pending)
  }

  private setStatus(patch: Partial<EngineStatus>) {
    this.status = { ...this.status, ...patch }
    this.listeners.forEach((l) => l())
  }
}

/** Thông tin trình duyệt dùng chung cho engine live và pool phân tích cả ván. */
export function browserEnv(): ManagerEnv {
  return {
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    cores: navigator.hardwareConcurrency || 4,
    // deviceMemory chỉ có trên Chromium, chưa có trong lib DOM của TypeScript
    deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    baseUrl: import.meta.env.BASE_URL,
    createTransport: workerTransport,
  }
}

let instance: EngineManager | null = null

/** Engine live dùng chung cho cả app; khởi động ở lần gọi đầu. */
export function getEngineManager(): EngineManager {
  if (!instance) {
    instance = new EngineManager(browserEnv())
    instance.start()
  }
  return instance
}
