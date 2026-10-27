// Tạo src/training/puzzles.json từ kho puzzle của lichess (CC0):
//   https://database.lichess.org/lichess_db_puzzle.csv.zst
// Cách chạy: node scripts/build-puzzles.mjs <đường dẫn tới lichess_db_puzzle.csv.zst>
// File .zst có thể chỉ tải được một phần: ID puzzle là ngẫu nhiên nên phần đầu file đã là mẫu đủ đều.
import { readFileSync, writeFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const PER_LEVEL = 3000
const MIN_POPULARITY = 80
const MIN_PLAYS = 300
/** Mức 5 gom cả mateIn5 trở lên. */
const LEVELS = [1, 2, 3, 4, 5]

/** Một dòng CSV → [id, fen, moves, rating, mateIn] hoặc null nếu không đạt. Không có cột nào chứa dấu phẩy. */
export function parseRow(line) {
  const [id, fen, moves, rating, , popularity, plays, themes] = line.split(',')
  if (!themes || id === 'PuzzleId') return null
  if (Number(popularity) < MIN_POPULARITY || Number(plays) < MIN_PLAYS) return null
  const match = /\bmateIn(\d)\b/.exec(themes)
  if (!match) return null
  const mateIn = Math.min(5, Number(match[1]))
  // Kiểm tra số nước: nước mở đầu + (2·mateIn − 1) nước
  if (mateIn < 5 && moves.split(' ').length !== 2 * mateIn) return null
  return [id, fen, moves, Number(rating), mateIn]
}

/** Lấy `count` bài rải đều theo rating (thứ tự cố định để tái lập được). */
export function sample(rows, count) {
  const sorted = [...rows].sort((a, b) => a[3] - b[3] || (a[0] < b[0] ? -1 : 1))
  if (sorted.length <= count) return sorted
  return Array.from({ length: count }, (_, i) => sorted[Math.floor((i * sorted.length) / count)])
}

/**
 * File của lichess ở dạng pzstd: trước mỗi frame zstd có một skippable frame 4 byte ghi độ dài frame đó
 * (zlib của Node không đọc được skippable frame). Giải nén từng frame; frame cuối bị cắt thì bỏ.
 */
function* decompressFrames(buf) {
  let pos = 0
  while (pos + 12 <= buf.length) {
    const magic = buf.readUInt32LE(pos)
    if ((magic & 0xfffffff0) !== 0x184d2a50) {
      // zstd thường (không có skippable frame): giải nén phần còn lại một lần
      try {
        yield zstdDecompressSync(buf.subarray(pos))
      } catch {
        console.warn('File zstd bị cắt dở: bỏ phần không giải nén được')
      }
      return
    }
    const hintSize = buf.readUInt32LE(pos + 4)
    const frameSize = buf.readUInt32LE(pos + 8)
    pos += 8 + hintSize
    if (pos + frameSize > buf.length) return
    yield zstdDecompressSync(buf.subarray(pos, pos + frameSize))
    pos += frameSize
  }
}

function main(path) {
  const buckets = new Map(LEVELS.map((l) => [l, []]))
  const buf = readFileSync(path)
  let total = 0
  // Cùng một thế cờ (bỏ qua số nước) chỉ giữ một bài, để không có đề trùng
  const positions = new Set()
  let rest = ''
  for (const chunk of decompressFrames(buf)) {
    const lines = (rest + chunk.toString('utf8')).split('\n')
    rest = lines.pop()
    for (const line of lines) {
      total++
      const row = parseRow(line.trim())
      if (!row) continue
      const key = row[1].split(" ").slice(0, 4).join(" ")
      if (positions.has(key)) continue
      positions.add(key)
      buckets.get(row[4]).push(row)
    }
  }
  const out = LEVELS.flatMap((l) => sample(buckets.get(l), PER_LEVEL))
  writeFileSync(new URL('../src/training/puzzles.json', import.meta.url), JSON.stringify(out))
  console.log(
    `${total} dòng → ${out.length} bài:`,
    LEVELS.map((l) => `M${l}=${Math.min(PER_LEVEL, buckets.get(l).length)}/${buckets.get(l).length}`).join(' '),
  )
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  if (!process.argv[2]) {
    console.error('Cách dùng: node scripts/build-puzzles.mjs <lichess_db_puzzle.csv.zst>')
    process.exit(1)
  }
  main(process.argv[2])
}
