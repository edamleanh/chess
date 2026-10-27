/** Kênh giao tiếp UCI với engine. Tách khỏi Worker để test được bằng transport giả. */
export interface EngineTransport {
  send(command: string): void
  onLine: ((line: string) => void) | null
  onError: ((message: string) => void) | null
  terminate(): void
}

export function workerTransport(url: string): EngineTransport {
  const worker = new Worker(url)
  const transport: EngineTransport = {
    send: (command) => worker.postMessage(command),
    onLine: null,
    onError: null,
    terminate: () => worker.terminate(),
  }
  worker.onmessage = (e: MessageEvent) => {
    if (typeof e.data === 'string') transport.onLine?.(e.data)
  }
  worker.onerror = (e: ErrorEvent) => {
    e.preventDefault()
    transport.onError?.(e.message || 'Không tải được engine')
  }
  return transport
}
