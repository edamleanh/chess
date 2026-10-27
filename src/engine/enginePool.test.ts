import { describe, expect, it } from 'vitest'
import { EnginePool, type PoolStatus } from './enginePool'
import { FakeTransport, flush } from './fakeTransport'
import { poolSize } from './flavors'

const LIMITS = { movetimeMs: 1000, maxDepth: 18, multiPv: 2 }
const fen = (i: number) => `8/8/8/8/8/8/8/K6k w - - 0 ${i + 1}`

function setup(opts: { cores?: number; memory?: number; failFull?: boolean; failAll?: boolean } = {}) {
  const transports: { url: string; t: FakeTransport }[] = []
  const statuses: PoolStatus[] = []
  const pool = new EnginePool(
    {
      cores: opts.cores ?? 4,
      deviceMemoryGb: opts.memory,
      baseUrl: '/',
      createTransport: (url) => {
        const fail = opts.failAll || (opts.failFull && url.endsWith('stockfish-19-single.js'))
        const t = new FakeTransport(!fail)
        if (fail) queueMicrotask(() => t.onError?.('out of memory'))
        transports.push({ url, t })
        return t
      },
    },
    'full-single',
    (s) => statuses.push(s),
  )
  /** Transport đang chạy search cho vị trí có FEN này. */
  const running = (i: number) => transports.find(({ t }) => t.sent.at(-2) === `position fen ${fen(i)}`)!.t
  return { pool, transports, statuses, running }
}

describe('poolSize', () => {
  it('Full: tối đa 5, để dư 1 nhân, giảm theo RAM', () => {
    expect(poolSize('full-single', 12)).toBe(5)
    expect(poolSize('full-single', 12, 8)).toBe(5)
    expect(poolSize('full-single', 12, 4)).toBe(2)
    expect(poolSize('full-single', 12, 2)).toBe(1)
    expect(poolSize('full-single', 12, 1)).toBe(0)
    expect(poolSize('full-single', 3)).toBe(2)
  })

  it('Lite: theo số nhân, tối đa 12', () => {
    expect(poolSize('lite-single', 12)).toBe(11)
    expect(poolSize('lite-single', 32)).toBe(12)
    expect(poolSize('lite-single', 1)).toBe(1)
  })
})

describe('EnginePool', () => {
  it('chạy song song tối đa số engine, phần còn lại xếp hàng theo thứ tự', async () => {
    const { pool, transports, running } = setup({ cores: 4 }) // 3 engine Full
    await flush()
    expect(pool.getStatus()).toMatchObject({ flavor: 'full-single', ready: 3, starting: 0 })

    const results = [0, 1, 2, 3, 4].map((i) => pool.analyze({ fen: fen(i) }, LIMITS))
    const searching = transports.filter(({ t }) => t.sent.at(-1)?.startsWith('go'))
    expect(searching).toHaveLength(3)

    running(1).emit('info depth 18 multipv 1 score cp 30 pv a1a2')
    running(1).emit('bestmove a1a2')
    await expect(results[1]).resolves.toMatchObject({ cancelled: false, bestMove: 'a1a2' })
    await flush()
    // engine vừa rảnh nhận vị trí 3 (FIFO)
    expect(running(3).sent.at(-1)).toBe('go depth 18 movetime 1000')
    pool.terminate()
    await expect(results[4]).resolves.toMatchObject({ cancelled: true })
  })

  it('engine crash giữa chừng: vị trí được giao cho engine khác', async () => {
    const { pool, running } = setup({ cores: 3 }) // 2 engine
    await flush()
    const r0 = pool.analyze({ fen: fen(0) }, LIMITS)
    const r1 = pool.analyze({ fen: fen(1) }, LIMITS)
    const crashed = running(0)
    crashed.onError?.('RuntimeError: unreachable')
    await flush()
    expect(pool.getStatus().ready).toBe(1)

    running(1).emit('info depth 18 multipv 1 score cp 0 pv a1b1')
    running(1).emit('bestmove a1b1')
    await expect(r1).resolves.toMatchObject({ bestMove: 'a1b1' })
    await flush()
    const retry = running(0)
    expect(retry).not.toBe(crashed)
    retry.emit('info depth 18 multipv 1 score cp 5 pv a1a2')
    retry.emit('bestmove a1a2')
    await expect(r0).resolves.toMatchObject({ cancelled: false, bestMove: 'a1a2' })
  })

  it('không khởi động được bản Full nào: chuyển sang Lite', async () => {
    const { pool, transports, statuses } = setup({ cores: 4, failFull: true })
    await flush()
    await flush()
    expect(pool.getStatus()).toMatchObject({ flavor: 'lite-single', ready: 3, failed: false })
    expect(transports.filter(({ url }) => url.endsWith('stockfish-19-lite-single.js'))).toHaveLength(3)
    expect(statuses.some((s) => s.flavor === 'full-single')).toBe(true)
  })

  it('RAM quá thấp cho bản Full: dùng Lite ngay', async () => {
    const { pool, transports } = setup({ cores: 4, memory: 1 })
    await flush()
    expect(pool.getStatus().flavor).toBe('lite-single')
    expect(transports.every(({ url }) => url.endsWith('lite-single.js'))).toBe(true)
  })

  it('mọi bản đều lỗi: báo thất bại và hủy các vị trí đang chờ', async () => {
    const { pool } = setup({ cores: 2, failAll: true })
    const r = pool.analyze({ fen: fen(0) }, LIMITS)
    await flush()
    await flush()
    await expect(r).resolves.toMatchObject({ cancelled: true })
    expect(pool.getStatus().failed).toBe(true)
  })
})
