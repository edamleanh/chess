// Tạo src/openings/openings.json từ bộ dữ liệu lichess-org/chess-openings (CC0).
// Chạy lại khi muốn cập nhật: node scripts/build-openings.mjs
//
// Khóa là EPD (4 trường đầu của FEN, do chess.js sinh, khớp với FEN trong GameModel). Giá trị:
//   [eco, name]  thế cờ cuối của một dòng (có tên khai cuộc)
//   0            thế cờ trung gian: vẫn là lý thuyết (Book) nhưng không có tên riêng
// Phải có thế cờ trung gian, nếu không Book sẽ dừng ngay giữa các biến dài (vd. Najdorf).
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'

/** Commit cố định để kết quả tái lập được. */
const COMMIT = 'a6189a30dc273ccb21fc2536a9a2fefd5592a67a'
const FILES = ['a', 'b', 'c', 'd', 'e']
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'openings', 'openings.json')

const epd = (fen) => fen.split(' ').slice(0, 4).join(' ')

const db = {}
let rows = 0
let duplicates = 0
for (const file of FILES) {
  const url = `https://raw.githubusercontent.com/lichess-org/chess-openings/${COMMIT}/${file}.tsv`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const lines = (await res.text()).trim().split('\n').slice(1) // bỏ dòng tiêu đề
  for (const [i, line] of lines.entries()) {
    const [eco, name, pgn] = line.split('\t')
    const chess = new Chess()
    try {
      chess.loadPgn(pgn)
    } catch (e) {
      throw new Error(`${file}.tsv dòng ${i + 2} (${eco} ${name}): ${e.message}`)
    }
    rows++
    const history = chess.history({ verbose: true })
    history.forEach((move, ply) => {
      const key = epd(move.after)
      if (ply === history.length - 1) {
        // Trùng tên (chuyển thế): giữ dòng đầu tiên
        if (Array.isArray(db[key])) duplicates++
        else db[key] = [eco, name]
      } else if (!(key in db)) {
        db[key] = 0
      }
    })
  }
}

// Kiểm tra: mọi dòng phải đi hết được lý thuyết của chính nó theo quy tắc "liên tiếp từ đầu ván"
let unreachable = 0
for (const file of FILES) {
  const res = await fetch(`https://raw.githubusercontent.com/lichess-org/chess-openings/${COMMIT}/${file}.tsv`)
  for (const line of (await res.text()).trim().split('\n').slice(1)) {
    const chess = new Chess()
    chess.loadPgn(line.split('\t')[2])
    if (!chess.history({ verbose: true }).every((m) => epd(m.after) in db)) unreachable++
  }
}
if (unreachable > 0) throw new Error(`${unreachable} dòng không đi hết được lý thuyết`)

const entries = Object.entries(db).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
writeFileSync(out, JSON.stringify(Object.fromEntries(entries)))
const named = entries.filter(([, v]) => Array.isArray(v)).length
console.log(
  `[build-openings] ${rows} dòng → ${entries.length} thế cờ (${named} có tên, ${duplicates} tên trùng thế cờ) → ${out}`,
)
