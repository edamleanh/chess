// Copy các bản Stockfish cần dùng từ node_modules sang public/stockfish/.
// Không commit các file này (file .wasm bản full khoảng 99 MB), xem .gitignore.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'stockfish', 'bin')
const dest = join(root, 'public', 'stockfish')

const FILES = [
  'stockfish-19.js',
  'stockfish-19.wasm',
  'stockfish-19-lite.js',
  'stockfish-19-lite.wasm',
  'stockfish-19-lite-single.js',
  'stockfish-19-lite-single.wasm',
  // Full 1 luồng: chạy nhiều bản song song khi phân tích cả ván
  'stockfish-19-single.js',
  'stockfish-19-single.wasm',
]

mkdirSync(dest, { recursive: true })
for (const file of FILES) {
  const from = join(src, file)
  const to = join(dest, file)
  if (!existsSync(from)) {
    console.error(`[copy-stockfish] Không tìm thấy ${from}. Đã chạy npm install chưa?`)
    process.exit(1)
  }
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue
  copyFileSync(from, to)
  console.log(`[copy-stockfish] ${file}`)
}
