import { describe, expect, it, vi } from 'vitest'
import { FakeTransport, flush } from './fakeTransport'
import { StockfishEngine } from './StockfishEngine'

const LIMITS = { movetimeMs: 1000, maxDepth: 20 }
const FEN_W = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const FEN_B = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

async function readyEngine() {
  const transport = new FakeTransport()
  const engine = new StockfishEngine(transport, { threads: 4, hashMb: 64 })
  await engine.init(1000)
  transport.sent = []
  return { transport, engine }
}

describe('StockfishEngine.init', () => {
  it('gửi uci → setoption → isready theo thứ tự', async () => {
    const transport = new FakeTransport()
    await new StockfishEngine(transport, { threads: 4, hashMb: 64 }).init(1000)
    expect(transport.sent).toEqual([
      'uci',
      'setoption name Threads value 4',
      'setoption name Hash value 64',
      'setoption name MultiPV value 1',
      'isready',
    ])
  })

  it('reject khi Worker báo lỗi', async () => {
    const transport = new FakeTransport(false)
    const init = new StockfishEngine(transport, { threads: 1, hashMb: 16 }).init(1000)
    transport.onError?.('out of memory')
    await expect(init).rejects.toThrow('out of memory')
  })

  it('reject khi quá thời gian', async () => {
    const transport = new FakeTransport(false)
    await expect(new StockfishEngine(transport, { threads: 1, hashMb: 16 }).init(10)).rejects.toThrow()
  })
})

describe('StockfishEngine.analyze', () => {
  it('gửi position + go, chuyển info về góc nhìn Trắng, trả bestmove', async () => {
    const { transport, engine } = await readyEngine()
    const onInfo = vi.fn()
    const result = engine.analyze({ fen: FEN_B }, LIMITS, onInfo)

    expect(transport.sent).toEqual([`position fen ${FEN_B}`, 'go depth 20 movetime 1000'])
    transport.emit('info depth 10 score cp 30 pv e7e5')
    transport.emit('info string ignored')
    transport.emit('bestmove e7e5 ponder g1f3')

    expect(onInfo).toHaveBeenCalledTimes(1)
    expect(onInfo.mock.calls[0][0]).toMatchObject({ depth: 10, score: { kind: 'cp', value: -30 }, pv: ['e7e5'] })
    await expect(result).resolves.toMatchObject({ cancelled: false, bestMove: 'e7e5' })
  })

  it('search mới: stop search cũ, bỏ info sau stop, chỉ chạy yêu cầu mới nhất', async () => {
    const { transport, engine } = await readyEngine()
    const first = vi.fn()
    const second = vi.fn()
    const third = vi.fn()

    const r1 = engine.analyze({ fen: FEN_W }, LIMITS, first)
    const r2 = engine.analyze({ fen: FEN_B }, LIMITS, second)
    const r3 = engine.analyze({ fen: FEN_W }, { movetimeMs: 500, maxDepth: 10 }, third)

    expect(transport.searchCommands()).toEqual([`position fen ${FEN_W}`, 'go depth 20 movetime 1000', 'stop'])
    await expect(r2).resolves.toMatchObject({ cancelled: true, bestMove: null })

    transport.emit('info depth 12 score cp 10 pv e2e4') // đến sau stop → bỏ qua
    transport.emit('bestmove e2e4')
    await expect(r1).resolves.toMatchObject({ cancelled: true, bestMove: null })
    expect(first).not.toHaveBeenCalled()

    expect(transport.searchCommands().slice(3)).toEqual([`position fen ${FEN_W}`, 'go depth 10 movetime 500'])
    transport.emit('info depth 1 score cp 20 pv d2d4')
    transport.emit('bestmove d2d4')
    await expect(r3).resolves.toMatchObject({ cancelled: false, bestMove: 'd2d4' })
    expect(second).not.toHaveBeenCalled()
    expect(third).toHaveBeenCalledTimes(1)
  })

  it('lastInfo là info chính xác cuối cùng: bỏ bound và multipv khác 1', async () => {
    const { transport, engine } = await readyEngine()
    const result = engine.analyze({ fen: FEN_B }, LIMITS, vi.fn())
    transport.emit('info depth 18 multipv 1 score cp 40 pv e7e5')
    transport.emit('info depth 19 multipv 1 score cp 90 lowerbound pv d7d5')
    transport.emit('info depth 19 multipv 2 score cp 10 pv c7c5')
    transport.emit('bestmove e7e5')
    const { lastInfo } = await result
    expect(lastInfo).toMatchObject({ depth: 18, score: { kind: 'cp', value: -40 }, pv: ['e7e5'] })
  })

  it('Worker lỗi sau khi khởi động: hủy search, báo onCrash, đóng transport', async () => {
    const { transport, engine } = await readyEngine()
    const onCrash = vi.fn()
    engine.onCrash = onCrash
    const r1 = engine.analyze({ fen: FEN_W }, LIMITS, vi.fn())
    const r2 = engine.analyze({ fen: FEN_B }, LIMITS, vi.fn())
    transport.onError?.('RuntimeError: unreachable')
    await expect(r1).resolves.toMatchObject({ cancelled: true })
    await expect(r2).resolves.toMatchObject({ cancelled: true })
    expect(onCrash).toHaveBeenCalledWith('RuntimeError: unreachable')
    expect(transport.terminated).toBe(true)
  })

  it('bestmove (none) → bestMove null', async () => {
    const { transport, engine } = await readyEngine()
    const result = engine.analyze({ fen: FEN_W }, LIMITS, vi.fn())
    transport.emit('info depth 0 score mate 0')
    transport.emit('bestmove (none)')
    await expect(result).resolves.toMatchObject({ cancelled: false, bestMove: null })
  })

  it('stop() hủy search hiện tại và yêu cầu đang chờ', async () => {
    const { transport, engine } = await readyEngine()
    const r1 = engine.analyze({ fen: FEN_W }, LIMITS, vi.fn())
    const r2 = engine.analyze({ fen: FEN_B }, LIMITS, vi.fn())
    engine.stop()
    await expect(r2).resolves.toMatchObject({ cancelled: true })
    transport.emit('bestmove e2e4')
    await expect(r1).resolves.toMatchObject({ cancelled: true })
    await flush()
    expect(transport.searchCommands().filter((c) => c.startsWith('go'))).toHaveLength(1)
  })

  it('terminate() hủy search và đóng transport', async () => {
    const { transport, engine } = await readyEngine()
    const result = engine.analyze({ fen: FEN_W }, LIMITS, vi.fn())
    engine.terminate()
    await expect(result).resolves.toMatchObject({ cancelled: true })
    expect(transport.terminated).toBe(true)
    await expect(engine.analyze({ fen: FEN_W }, LIMITS, vi.fn())).resolves.toMatchObject({ cancelled: true })
  })
})
