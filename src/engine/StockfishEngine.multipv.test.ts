import { describe, expect, it, vi } from 'vitest'
import { FakeTransport, flush } from './fakeTransport'
import { positionCommand, StockfishEngine } from './StockfishEngine'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

async function readyEngine() {
  const transport = new FakeTransport()
  const engine = new StockfishEngine(transport, { threads: 2, hashMb: 16 })
  await engine.init(1000)
  transport.sent = []
  return { transport, engine }
}

describe('positionCommand', () => {
  it('có lịch sử thì gửi startFen + moves, không thì gửi fen', () => {
    expect(positionCommand({ fen: AFTER_E4, startFen: START, moves: ['e2e4'] })).toBe(
      `position fen ${START} moves e2e4`,
    )
    expect(positionCommand({ fen: START, startFen: START, moves: [] })).toBe(`position fen ${START}`)
    expect(positionCommand({ fen: AFTER_E4 })).toBe(`position fen ${AFTER_E4}`)
  })
})

describe('StockfishEngine: MultiPV và lịch sử nước', () => {
  it('chỉ gửi setoption MultiPV khi giá trị thay đổi', async () => {
    const { transport, engine } = await readyEngine()
    const limits = { movetimeMs: 100, maxDepth: 10, multiPv: 2 }

    const r1 = engine.analyze({ fen: START }, limits, vi.fn())
    transport.emit('bestmove e2e4')
    await r1
    const r2 = engine.analyze({ fen: START }, limits, vi.fn())
    transport.emit('bestmove e2e4')
    await r2
    const r3 = engine.analyze({ fen: START }, { movetimeMs: 100, maxDepth: 10 }, vi.fn())
    transport.emit('bestmove e2e4')
    await r3

    expect(transport.sent.filter((c) => c.startsWith('setoption'))).toEqual([
      'setoption name MultiPV value 2',
      'setoption name MultiPV value 1',
    ])
  })

  it('lines giữ info chính xác cuối của từng biến, theo góc nhìn Trắng', async () => {
    const { transport, engine } = await readyEngine()
    const result = engine.analyze(
      { fen: AFTER_E4, startFen: START, moves: ['e2e4'] },
      { movetimeMs: 100, maxDepth: 10, multiPv: 2 },
      vi.fn(),
    )
    expect(transport.sent).toContain(`position fen ${START} moves e2e4`)
    transport.emit('info depth 10 multipv 1 score cp 20 pv c7c5')
    transport.emit('info depth 10 multipv 2 score cp 5 pv e7e5')
    transport.emit('info depth 11 multipv 1 score cp 60 upperbound pv d7d5')
    transport.emit('bestmove c7c5')

    const { lines, lastInfo, bestMove } = await result
    expect(bestMove).toBe('c7c5')
    expect(lines.map((l) => [l.pv[0], l.score])).toEqual([
      ['c7c5', { kind: 'cp', value: -20 }],
      ['e7e5', { kind: 'cp', value: -5 }],
    ])
    expect(lastInfo).toBe(lines[0])
  })
})

describe('StockfishEngine.newGame', () => {
  it('dừng search đang chạy, chờ bestmove rồi gửi ucinewgame + isready', async () => {
    const { transport, engine } = await readyEngine()
    const search = engine.analyze({ fen: START }, { movetimeMs: 100, maxDepth: 10 }, vi.fn())
    const done = vi.fn()
    void engine.newGame().then(done)

    expect(transport.sent.at(-1)).toBe('stop')
    expect(transport.sent).not.toContain('ucinewgame')
    transport.emit('bestmove e2e4')
    await expect(search).resolves.toMatchObject({ cancelled: true })
    await flush()
    expect(transport.sent.slice(-2)).toEqual(['ucinewgame', 'isready'])
    expect(done).toHaveBeenCalled() // FakeTransport tự trả readyok
  })

  it('không treo nếu engine bị terminate giữa chừng', async () => {
    const transport = new FakeTransport(false)
    const engine = new StockfishEngine(transport, { threads: 1, hashMb: 16 })
    const done = engine.newGame()
    engine.terminate()
    await expect(done).resolves.toBeUndefined()
  })
})
