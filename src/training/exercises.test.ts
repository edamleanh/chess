import { describe, expect, it } from 'vitest'
import { seededRandom } from './endgames'
import { EXERCISES, isEndgame, pickTask, puzzlesFor } from './exercises'
import type { Puzzle } from './puzzle'

const puzzle = (id: string, mateIn: number): Puzzle => ({ id, fen: '', moves: [], rating: 1500, mateIn })
const PUZZLES = [puzzle('a', 1), puzzle('b', 1), puzzle('c', 2), puzzle('d', 4), puzzle('e', 5)]

describe('pickTask', () => {
  it('lọc puzzle theo mức', () => {
    const random = seededRandom(1)
    for (let i = 0; i < 20; i++) {
      const task = pickTask('m45', PUZZLES, new Set(), random)
      expect(task?.kind === 'puzzle' && task.puzzle.mateIn).toBeGreaterThanOrEqual(4)
    }
    expect(pickTask('m3', PUZZLES)).toBeNull()
  })

  it('chỉ chọn bài chưa gặp; gặp hết thì chọn lại trong cả mức', () => {
    const random = seededRandom(5)
    for (let i = 0; i < 10; i++) {
      const task = pickTask('m1', PUZZLES, new Set(['a']), random)
      expect(task?.kind === 'puzzle' && task.puzzle.id).toBe('b')
    }
    const again = pickTask('m1', PUZZLES, new Set(['a', 'b']), random)
    expect(again?.kind === 'puzzle' && ['a', 'b'].includes(again.puzzle.id)).toBe(true)
  })

  it('đi hết một mức không trùng bài nào', () => {
    const seen = new Set<string>()
    const random = seededRandom(9)
    for (let i = 0; i < PUZZLES.length; i++) {
      const task = pickTask('mix', PUZZLES, seen, random)
      if (task?.kind === 'puzzle') seen.add(task.puzzle.id)
    }
    expect(seen.size).toBe(PUZZLES.length)
  })

  it('puzzlesFor', () => {
    expect(puzzlesFor('m1', PUZZLES).map((p) => p.id)).toEqual(['a', 'b'])
    expect(puzzlesFor('m13', PUZZLES).map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(puzzlesFor('KQ', PUZZLES)).toEqual([])
  })

  it('chiếu hết cơ bản sinh thế cờ mới', () => {
    const task = pickTask('KBN', [], new Set(), seededRandom(3))
    expect(task?.kind).toBe('endgame')
  })

  it('danh sách loại bài', () => {
    expect(EXERCISES.filter((e) => e.group === 'endgame').map((e) => e.id)).toEqual(['KQ', 'KR', 'KBB', 'KBN'])
    expect(isEndgame('KR')).toBe(true)
    expect(isEndgame('m2')).toBe(false)
  })
})
