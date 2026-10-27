import type { EngineTransport } from './transport'

/** Transport giả cho test: ghi lại lệnh đã gửi, tự trả lời uciok/readyok nếu `autoReady`. */
export class FakeTransport implements EngineTransport {
  sent: string[] = []
  onLine: ((line: string) => void) | null = null
  onError: ((message: string) => void) | null = null
  terminated = false
  autoReady: boolean

  constructor(autoReady = true) {
    this.autoReady = autoReady
  }

  send(command: string): void {
    this.sent.push(command)
    if (!this.autoReady) return
    if (command === 'uci') queueMicrotask(() => this.emit('uciok'))
    if (command === 'isready') queueMicrotask(() => this.emit('readyok'))
  }

  emit(line: string): void {
    this.onLine?.(line)
  }

  terminate(): void {
    this.terminated = true
  }

  /** Các lệnh `go`/`stop`/`position` đã gửi, bỏ qua phần khởi tạo. */
  searchCommands(): string[] {
    return this.sent.filter((c) => c.startsWith('position') || c.startsWith('go') || c === 'stop')
  }
}

/** Chờ các microtask/promise đang treo chạy xong. */
export const flush = () => new Promise((r) => setTimeout(r, 0))
