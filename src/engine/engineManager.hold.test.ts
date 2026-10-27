import { describe, expect, it, vi } from 'vitest'
import { EngineManager } from './engineManager'
import { FakeTransport, flush } from './fakeTransport'

const LIMITS = { movetimeMs: 1000, maxDepth: 20 }
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

async function readyManager() {
  const transports: FakeTransport[] = []
  const manager = new EngineManager({
    crossOriginIsolated: false, // chỉ một bản Lite single-thread: đơn giản cho test
    cores: 4,
    baseUrl: '/',
    createTransport: () => {
      const t = new FakeTransport()
      transports.push(t)
      return t
    },
  })
  manager.start()
  await flush()
  return { manager, engine: transports[0] }
}

describe('EngineManager.holdLive', () => {
  it('giữ: dừng search live đang chạy, hoãn yêu cầu mới; thả: chạy lại yêu cầu mới nhất', async () => {
    const { manager, engine } = await readyManager()
    const first = manager.analyze({ fen: START }, LIMITS, vi.fn())
    expect(engine.searchCommands()).toEqual([`position fen ${START}`, 'go depth 20 movetime 1000'])

    const release = manager.holdLive()
    expect(engine.searchCommands().at(-1)).toBe('stop')
    const second = manager.analyze({ fen: AFTER_E4 }, LIMITS, vi.fn())
    await expect(first).resolves.toMatchObject({ cancelled: true })
    engine.emit('bestmove e2e4') // search cũ kết thúc
    await flush()
    expect(engine.searchCommands()).toHaveLength(3) // không có search mới trong lúc bị giữ

    release()
    await flush()
    expect(engine.searchCommands().slice(-2)).toEqual([`position fen ${AFTER_E4}`, 'go depth 20 movetime 1000'])
    engine.emit('bestmove e7e5')
    await expect(second).resolves.toMatchObject({ cancelled: false, bestMove: 'e7e5' })
  })

  it('nhiều nơi cùng giữ: chỉ chạy lại khi tất cả đã thả; thả 2 lần không làm lệch bộ đếm', async () => {
    const { manager, engine } = await readyManager()
    const a = manager.holdLive()
    const b = manager.holdLive()
    void manager.analyze({ fen: START }, LIMITS, vi.fn())
    a()
    a()
    await flush()
    expect(engine.searchCommands()).toEqual([])
    b()
    await flush()
    expect(engine.searchCommands()).toEqual([`position fen ${START}`, 'go depth 20 movetime 1000'])
  })

  it('stop() trong lúc bị giữ hủy yêu cầu đang hoãn; thả ra không chạy gì', async () => {
    const { manager, engine } = await readyManager()
    const release = manager.holdLive()
    const r = manager.analyze({ fen: START }, LIMITS, vi.fn())
    manager.stop()
    await expect(r).resolves.toMatchObject({ cancelled: true })
    release()
    await flush()
    expect(engine.searchCommands()).toEqual([])
  })
})
