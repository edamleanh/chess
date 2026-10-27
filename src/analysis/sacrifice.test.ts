import { describe, expect, it } from 'vitest'
import { parsePgn } from '../chess/parsePgn'
import { SAMPLE_PGN } from '../chess/samplePgn'
import { isSacrifice } from './sacrifice'

function plyOf(pgn: string, san: string) {
  const parsed = parsePgn(pgn)
  if (!parsed.ok) throw new Error(parsed.error)
  const ply = parsed.game.plies.find((p) => p.san === san)
  if (!ply) throw new Error(`không có nước ${san}`)
  return ply
}

describe('isSacrifice', () => {
  it('16.Qb8+ của Morphy: Hậu đứng ở ô Mã ăn được, không có quân bảo vệ', () => {
    const ply = plyOf(SAMPLE_PGN, 'Qb8+')
    expect(isSacrifice(ply.fenBefore, ply.uci)).toBe(true)
  })

  it('ăn đổi ngang giá không phải thí quân', () => {
    const ply = plyOf('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 *', 'Bxc6')
    expect(isSacrifice(ply.fenBefore, ply.uci)).toBe(false)
  })

  it('quân được bảo vệ, chỉ bị quân cùng giá trị tấn công: không phải thí quân', () => {
    const ply = plyOf('1. e4 e5 2. Nf3 Nf6 3. Nc3 Nc6 4. Nd5 *', 'Nd5') // Nd5 bị Nf6 tấn công, e4 bảo vệ
    expect(isSacrifice(ply.fenBefore, ply.uci)).toBe(false)
  })

  it('nước Tốt và nước chiếu hết không tính', () => {
    expect(isSacrifice('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e4')).toBe(false)
    const mate = plyOf('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0', 'Qxf7#')
    expect(isSacrifice(mate.fenBefore, mate.uci)).toBe(false)
  })

  it('phong cấp vào ô bị khống chế không phải thí quân', () => {
    // Tốt e7 phong cấp, Xe a8 ăn được Hậu nhưng Vua f7 ăn lại
    expect(isSacrifice('r6k/4PK2/8/8/8/8/8/8 w - - 0 1', 'e7e8q')).toBe(false)
  })

  it('quân tấn công bị ghim thì không ăn được', () => {
    // Mã c6 bị Tượng b5 ghim vào Vua e8, nên Nd4 không bị ăn
    expect(isSacrifice('4k3/8/2n5/1B6/8/5N2/8/4K3 w - - 0 1', 'f3d4')).toBe(false)
  })

  it('chiếu mở: đối phương đang bị chiếu nên không ăn được quân vừa đi', () => {
    // Ne4-c5 mở đường chiếu của Xe e1; Tốt b6 không được ăn c5 vì phải thoát chiếu
    expect(isSacrifice('4k3/8/1p6/8/4N3/8/8/4RK2 w - - 0 1', 'e4c5')).toBe(false)
  })

  it('UCI không hợp lệ → false', () => {
    expect(isSacrifice('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e5')).toBe(false)
  })
})
