import type { EngineOptions } from './StockfishEngine'

export type FlavorId = 'full' | 'lite' | 'lite-single' | 'full-single'

export interface Flavor {
  id: FlavorId
  label: string
  file: string
  multiThreaded: boolean
  hashMb: number
  /** Thời gian chờ khởi động. Bản full phải tải file khoảng 99 MB. */
  initTimeoutMs: number
}

export const FLAVORS: Record<FlavorId, Flavor> = {
  full: {
    id: 'full',
    label: 'Stockfish 19',
    file: 'stockfish-19.js',
    multiThreaded: true,
    hashMb: 256,
    initTimeoutMs: 5 * 60_000,
  },
  lite: {
    id: 'lite',
    label: 'Stockfish 19 Lite',
    file: 'stockfish-19-lite.js',
    multiThreaded: true,
    hashMb: 64,
    initTimeoutMs: 60_000,
  },
  'lite-single': {
    id: 'lite-single',
    label: 'Stockfish 19 Lite',
    file: 'stockfish-19-lite-single.js',
    multiThreaded: false,
    hashMb: 64,
    initTimeoutMs: 60_000,
  },
  // Dùng trong EnginePool: nhiều bản 1 luồng chạy song song, mỗi bản một vị trí
  'full-single': {
    id: 'full-single',
    label: 'Stockfish 19',
    file: 'stockfish-19-single.js',
    multiThreaded: false,
    hashMb: 64,
    initTimeoutMs: 5 * 60_000,
  },
}

/** Mỗi engine Full chiếm khoảng 170 MB (mạng NNUE ~100 MB + hash + wasm). */
const FULL_ENGINE_MAX = 5
const LITE_ENGINE_MAX = 12

/**
 * Số engine chạy song song khi phân tích cả ván. Mỗi engine 1 luồng nên để dư 1 nhân cho giao diện.
 * Đo trên máy 12 nhân: 5×Full 1 luồng cho chất lượng ngang Full 11 luồng nhưng nhanh hơn ~4,5 lần
 * (vị trí trong ván độc lập nhau, chia việc hiệu quả hơn dồn luồng vào một vị trí).
 * RAM thấp (navigator.deviceMemory, Chrome báo tối đa 8) thì giảm số engine Full; ≤ 2 GB thì không dùng Full.
 */
export function poolSize(flavor: 'full-single' | 'lite-single', cores: number, deviceMemoryGb?: number): number {
  const byCores = Math.max(1, cores - 1)
  if (flavor === 'lite-single') return Math.min(byCores, LITE_ENGINE_MAX)
  const byMemory = deviceMemoryGb === undefined ? FULL_ENGINE_MAX : Math.floor(deviceMemoryGb / 1.6)
  return Math.max(0, Math.min(byCores, FULL_ENGINE_MAX, byMemory))
}

/**
 * Có cross-origin isolation (SharedArrayBuffer): chạy Lite đa luồng ngay, tải Full đa luồng ở nền.
 * Không có: chỉ dùng Lite single-thread.
 */
export function pickFlavors(crossOriginIsolated: boolean): { bridge: FlavorId; target: FlavorId | null } {
  return crossOriginIsolated ? { bridge: 'lite', target: 'full' } : { bridge: 'lite-single', target: null }
}

/** Máy có RAM ≤ 4 GB (theo navigator.deviceMemory) dùng Hash nhỏ hơn để tránh hết bộ nhớ. */
const LOW_MEMORY_GB = 4
const LOW_MEMORY_HASH_MB = 128

export function engineOptions(flavor: Flavor, cores: number, deviceMemoryGb?: number): EngineOptions {
  const lowMemory = deviceMemoryGb !== undefined && deviceMemoryGb <= LOW_MEMORY_GB
  return {
    threads: flavor.multiThreaded ? Math.max(1, cores - 1) : 1,
    hashMb: lowMemory ? Math.min(flavor.hashMb, LOW_MEMORY_HASH_MB) : flavor.hashMb,
  }
}

export function flavorUrl(flavor: Flavor, baseUrl: string): string {
  return `${baseUrl}stockfish/${flavor.file}`
}
