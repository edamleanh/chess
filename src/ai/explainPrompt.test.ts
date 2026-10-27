import { describe, expect, it } from 'vitest'
import { classifyMove } from '../analysis/classifyMove'
import { parsePgn } from '../chess/parsePgn'
import type { PositionEval } from '../types'
import { buildExplainPrompt, EXPLAIN_SYSTEM } from './explainPrompt'

const parsed = parsePgn('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0')
if (!parsed.ok) throw new Error(parsed.error)
const nf6 = parsed.game.plies[5]

// Eval thật lấy từ lần chạy Stockfish 19 trên vị trí này (góc nhìn Trắng)
const before: PositionEval = {
  score: { kind: 'cp', value: -20 },
  bestMove: 'g7g6',
  lines: [
    { score: { kind: 'cp', value: -20 }, pv: ['g7g6', 'h5f3', 'g8f6'] },
    { score: { kind: 'cp', value: 0 }, pv: ['d8e7', 'g1f3'] },
  ],
  depth: 22,
}
const after: PositionEval = {
  score: { kind: 'mate', value: 1 },
  bestMove: 'h5f7',
  lines: [{ score: { kind: 'mate', value: 1 }, pv: ['h5f7'] }],
  depth: 30,
}

describe('buildExplainPrompt', () => {
  const review = classifyMove(nf6, before, after)
  const { system, user } = buildExplainPrompt({
    ply: nf6,
    review,
    before,
    after,
    opening: { eco: 'C20', name: "King's Pawn Game: Wayward Queen Attack" },
  })

  it('system yêu cầu chỉ dựa vào dữ liệu engine và giải thích ký hiệu eval', () => {
    expect(system).toBe(EXPLAIN_SYSTEM)
    expect(system).toMatch(/Chỉ dựa vào dữ liệu được cung cấp/)
    expect(system).toMatch(/không suy ra đòn chiến thuật không có trong các biến chính/)
    expect(system).toMatch(/luôn theo góc nhìn bên Trắng/)
    expect(system).toMatch(/-M3: Đen chiếu hết sau 3 nước/)
  })

  it('user chứa nước đi, nhãn, eval, nước tốt nhất và biến trả đòn đều ở dạng SAN', () => {
    expect(review.class).toBe('blunder')
    expect(user).toContain('Nước đã đi: 3... Nf6')
    expect(user).toContain('Đánh giá của app: Sai lầm nghiêm trọng\n')
    expect(user).toContain('Eval sau nước đi: M1')
    expect(user).toContain('Cơ hội thắng của Đen (thang 0–100 của lichess, tính cả khả năng hòa)')
    expect(user).toContain('Vì sao Nf6 là nước "sai lầm nghiêm trọng", và lẽ ra nên đi gì?')
    expect(user).toContain('Nước tốt nhất của engine và biến chính: g6 Qf3 Nf6')
    expect(user).toContain('Nước tốt thứ hai và biến chính: Qe7 Nf3')
    expect(user).toContain('Sau Nf6, biến tốt nhất của Trắng: Qxf7#')
    expect(user).toContain('Khai cuộc: C20')
    expect(user).toContain(nf6.fenBefore)
  })

  it('có bàn cờ ASCII của vị trí trước nước đi', () => {
    expect(user).toMatch(/\+-{24}\+/)
  })

  it('nước tốt nhất theo đúng bestMove (nhãn Best dựa vào), kể cả khi khác biến 1', () => {
    const swapped: PositionEval = { ...before, bestMove: 'd8e7' }
    const r = classifyMove(nf6, swapped, after)
    const prompt = buildExplainPrompt({ ply: nf6, review: r, before: swapped, after, opening: null })
    expect(prompt.user).toContain('Nước tốt nhất của engine và biến chính: Qe7 Nf3')
    expect(prompt.user).toContain('Nước tốt thứ hai và biến chính: g6 Qf3 Nf6')
  })

  it('nước tốt: nêu lý do app gắn nhãn và hỏi theo hướng điểm mạnh', () => {
    const g6 = parsePgn('1. e4 e5 2. Qh5 Nc6 3. Bc4 g6 *')
    if (!g6.ok) throw new Error(g6.error)
    const ply = g6.game.plies[5]
    const good: PositionEval = { ...before, lines: [before.lines[0], { score: { kind: 'cp', value: 800 }, pv: ['d8e7'] }] }
    const r = classifyMove(ply, good, before)
    expect(r.class).toBe('great')
    const prompt = buildExplainPrompt({ ply, review: r, before: good, after: before, opening: null })
    expect(prompt.user).toContain('Đánh giá của app: Tuyệt vời (vì nước tốt nhất, và mọi nước khác đều làm kết quả xấu đi')
    expect(prompt.user).toContain('Vì sao g6 được đánh giá là nước "tuyệt vời"?')
  })

  it('vị trí sau là kết thúc ván: ghi rõ thay vì biến chính', () => {
    const mate = parsed.game.plies[6]
    const end: PositionEval = { score: { kind: 'gameover', outcome: 'win' }, bestMove: null, lines: [], depth: null }
    const r = classifyMove(mate, after, end)
    const prompt = buildExplainPrompt({ ply: mate, review: r, before: after, after: end, opening: null })
    expect(prompt.user).toContain('Sau Qxf7#: ván kết thúc (1-0)')
    expect(prompt.user).not.toContain('Khai cuộc')
  })
})
