import { describe, expect, it, vi } from 'vitest'
import { EngineManager } from './engineManager'
import { FakeTransport, flush } from './fakeTransport'

const LIMITS = { movetimeMs: 1000, maxDepth: 20 }
const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function setup(crossOriginIsolated: boolean) {
  const transports = new Map<string, FakeTransport>()
  const manager = new EngineManager({
    crossOriginIsolated,
    cores: 8,
    baseUrl: '/',
    createTransport: (url) => {
      // Bản Full tự trả lời chậm (do test điều khiển), bản Lite sẵn sàng ngay
      const t = new FakeTransport(!url.endsWith('stockfish-19.js'))
      transports.set(url, t)
      return t
    },
  })
  return { manager, transports }
}

describe('EngineManager', () => {
  it('chạy Lite trước, chuyển sang Full khi sẵn sàng và chạy lại vị trí đang xem', async () => {
    const { manager, transports } = setup(true)
    const onInfo = vi.fn()
    manager.start()
    const result = manager.analyze({ fen: FEN }, LIMITS, onInfo)
    await flush()

    const lite = transports.get('/stockfish/stockfish-19-lite.js')!
    const full = transports.get('/stockfish/stockfish-19.js')!
    expect(manager.getStatus()).toMatchObject({ flavor: 'lite', threads: 7, loadingFull: true })
    expect(lite.searchCommands()).toEqual([`position fen ${FEN}`, 'go depth 20 movetime 1000'])

    full.emit('uciok')
    await flush()
    full.emit('readyok')
    await flush()

    expect(manager.getStatus()).toMatchObject({ flavor: 'full', loadingFull: false, error: null })
    expect(lite.terminated).toBe(true)
    expect(full.sent).toContain('setoption name Hash value 256')
    expect(full.searchCommands()).toEqual([`position fen ${FEN}`, 'go depth 20 movetime 1000'])

    full.emit('info depth 22 score cp 25 pv e2e4')
    full.emit('bestmove e2e4')
    await expect(result).resolves.toMatchObject({ cancelled: false, bestMove: 'e2e4' })
    expect(onInfo).toHaveBeenCalledTimes(1)
  })

  it('Full lỗi thì giữ Lite, không báo lỗi', async () => {
    const { manager, transports } = setup(true)
    manager.start()
    await flush()
    transports.get('/stockfish/stockfish-19.js')!.onError?.('out of memory')
    await flush()
    expect(manager.getStatus()).toMatchObject({ flavor: 'lite', loadingFull: false, error: null })
  })

  it('không có cross-origin isolation thì chỉ dùng Lite single-thread', async () => {
    const { manager, transports } = setup(false)
    manager.start()
    await flush()
    expect([...transports.keys()]).toEqual(['/stockfish/stockfish-19-lite-single.js'])
    expect(manager.getStatus()).toMatchObject({ flavor: 'lite-single', threads: 1, loadingFull: false })
  })

  it('đổi sang Full khi Lite đang dừng search cũ và có yêu cầu chờ: chỉ chạy yêu cầu mới nhất trên Full', async () => {
    const { manager, transports } = setup(true)
    manager.start()
    await flush()
    const lite = transports.get('/stockfish/stockfish-19-lite.js')!
    const full = transports.get('/stockfish/stockfish-19.js')!

    const r1 = manager.analyze({ fen: FEN }, LIMITS, vi.fn())
    const fen2 = '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1'
    const r2 = manager.analyze({ fen: fen2 }, LIMITS, vi.fn())
    expect(lite.searchCommands().at(-1)).toBe('stop')
    await expect(r1).resolves.toMatchObject({ cancelled: true })

    full.emit('uciok')
    await flush()
    full.emit('readyok')
    await flush()
    expect(full.searchCommands()).toEqual([`position fen ${fen2}`, 'go depth 20 movetime 1000'])

    full.emit('bestmove e1d2')
    await expect(r2).resolves.toMatchObject({ cancelled: false, bestMove: 'e1d2' })
  })

  it('Full crash lúc đang chạy: quay về Lite và chạy lại yêu cầu', async () => {
    const { manager, transports } = setup(true)
    manager.start()
    const full = transports.get('/stockfish/stockfish-19.js')!
    full.emit('uciok')
    await flush()
    full.emit('readyok')
    await flush()
    expect(manager.getStatus().flavor).toBe('full')

    const result = manager.analyze({ fen: FEN }, LIMITS, vi.fn())
    full.onError?.('out of memory')
    await flush()
    await flush()

    expect(manager.getStatus()).toMatchObject({ flavor: 'lite', error: null })
    const relaunched = transports.get('/stockfish/stockfish-19-lite.js')!
    expect(relaunched.searchCommands()).toEqual([`position fen ${FEN}`, 'go depth 20 movetime 1000'])
    relaunched.emit('bestmove e2e4')
    await expect(result).resolves.toMatchObject({ cancelled: false, bestMove: 'e2e4' })
  })

  it('mọi bản đều lỗi: báo lỗi và hủy yêu cầu đang chờ', async () => {
    const transports: FakeTransport[] = []
    const manager = new EngineManager({
      crossOriginIsolated: false,
      cores: 4,
      baseUrl: '/',
      createTransport: () => {
        const t = new FakeTransport(false)
        transports.push(t)
        return t
      },
    })
    manager.start()
    const result = manager.analyze({ fen: FEN }, LIMITS, vi.fn())
    transports[0].onError?.('404')
    await expect(result).resolves.toMatchObject({ cancelled: true })
    expect(manager.getStatus().error).toBe('Không khởi động được engine')
  })

  it('stop() hủy yêu cầu đang chạy', async () => {
    const { manager } = setup(false)
    manager.start()
    await flush()
    const result = manager.analyze({ fen: FEN }, LIMITS, vi.fn())
    manager.stop()
    await expect(result).resolves.toMatchObject({ cancelled: true })
  })
})
