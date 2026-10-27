import { Chess } from 'chess.js'
import type { MoveClass, MoveReview } from '../analysis/classifyMove'
import { MOVE_CLASS_META } from '../analysis/moveClassMeta'
import { pvToSan } from '../chess/pvToSan'
import { formatScore } from '../engine/formatScore'
import type { Opening } from '../openings/openings'
import type { Ply, PositionEval } from '../types'

export interface ExplainInput {
  ply: Ply
  review: MoveReview
  /** Eval batch của ply.fenBefore và ply.fenAfter (góc nhìn Trắng). */
  before: PositionEval
  after: PositionEval
  /** Khai cuộc tính tới nước này. */
  opening: Opening | null
}

export interface ExplainPrompt {
  system: string
  user: string
}

/** Độ dài biến chính đưa cho AI: đủ để thấy ý đồ, không quá dài để AI bịa thêm. */
const PV_PLIES = 8

export const EXPLAIN_SYSTEM = `Bạn là huấn luyện viên cờ vua, giải thích cho người chơi nghiệp dư bằng tiếng Việt.

Bạn nhận dữ liệu phân tích của Stockfish cho một nước đi. Quy tắc bắt buộc:
- Chỉ dựa vào dữ liệu được cung cấp (vị trí, eval, nước tốt nhất và các biến chính của engine). Không tự tính toán thêm nước đi, không bịa biến mới, không suy ra đòn chiến thuật không có trong các biến chính.
- Nếu dữ liệu không đủ để giải thích chắc chắn, nói rõ điều đó.
- Ghi nước đi bằng ký hiệu SAN (ví dụ Nf3, exd5, O-O) đúng như trong dữ liệu.

Cách đọc eval (luôn theo góc nhìn bên Trắng):
- Số như +1.50 / -0.80: lợi thế tính bằng Tốt; dương là Trắng hơn, âm là Đen hơn.
- M3: Trắng chiếu hết sau 3 nước; -M3: Đen chiếu hết sau 3 nước.
- 1-0 / 0-1 / ½-½: ván đã kết thúc (Trắng thắng / Đen thắng / hòa).

Hãy giải thích trong 3–6 câu:
1. Nước đã đi tốt hoặc dở ở điểm nào, dựa trên eval và biến chính của đối phương sau nước đó.
2. Nếu nước đã đi không phải nước tốt nhất: nước tốt nhất của engine nhằm mục đích gì.
3. Một bài học ngắn gọn rút ra.

Viết văn xuôi, không dùng tiêu đề hay danh sách.`

/** Lý do app gắn nhãn, để AI không phải tự đoán (tránh bịa lý do). */
const LABEL_REASON: Partial<Record<MoveClass, string>> = {
  brilliant: 'nước thí quân (quân vừa đi có thể bị ăn mà bên đi lỗ vật chất) nhưng không làm thế cờ xấu đi',
  great:
    'nước tốt nhất, và mọi nước khác đều làm kết quả xấu đi một bậc (vd. từ thắng xuống cân bằng): là nước quyết định',
  miss: 'đối phương vừa đi dở nhưng nước này không tận dụng được cơ hội, thế cờ rơi xuống mức tệ hơn',
  best: 'trùng với nước tốt nhất của engine',
}

const BAD: MoveClass[] = ['inaccuracy', 'mistake', 'miss', 'blunder']

function line(fen: string, pv: string[]): string {
  const san = pvToSan(fen, pv.slice(0, PV_PLIES))
  return san.length > 0 ? san.join(' ') : '(không có)'
}

const side = (color: 'w' | 'b') => (color === 'w' ? 'Trắng' : 'Đen')

/** Dựng prompt từ dữ liệu engine; AI chỉ diễn giải những gì có ở đây. */
export function buildExplainPrompt({ ply, review, before, after, opening }: ExplainInput): ExplainPrompt {
  const board = new Chess(ply.fenBefore).ascii()
  const moveNo = `${ply.moveNumber}${ply.color === 'w' ? '.' : '...'}`
  const label = MOVE_CLASS_META[review.class].label
  // Nước tốt nhất: đúng `bestMove` mà nhãn Best dựa vào; biến của nó lấy từ line tương ứng nếu có
  const bestLine = before.lines.find((l) => l.pv[0] === before.bestMove) ?? before.lines[0]
  const otherLine = before.lines.find((l) => l !== bestLine)
  const reply = after.lines[0]
  const opponent = side(ply.color === 'w' ? 'b' : 'w')
  const reason = LABEL_REASON[review.class]

  const parts = [
    `Vị trí trước nước đi (FEN): ${ply.fenBefore}`,
    `Bàn cờ (chữ hoa là Trắng, chữ thường là Đen; hàng 8 ở trên):\n${board}`,
    `Bên đi: ${side(ply.color)}`,
    opening ? `Khai cuộc: ${opening.eco} ${opening.name}` : null,
    '',
    `Nước đã đi: ${moveNo} ${ply.san}`,
    `Đánh giá của app: ${label}${reason ? ` (vì ${reason})` : ''}`,
    `Eval trước nước đi: ${formatScore(before.score)}`,
    `Eval sau nước đi: ${formatScore(after.score)}`,
    `Cơ hội thắng của ${side(ply.color)} (thang 0–100 của lichess, tính cả khả năng hòa): ` +
      `${review.winBefore.toFixed(0)} → ${review.winAfter.toFixed(0)}`,
    '',
    bestLine
      ? `Nước tốt nhất của engine và biến chính: ${line(ply.fenBefore, bestLine.pv)} (eval ${formatScore(bestLine.score)})`
      : 'Nước tốt nhất của engine: (không có dữ liệu)',
    otherLine
      ? `Nước tốt thứ hai và biến chính: ${line(ply.fenBefore, otherLine.pv)} (eval ${formatScore(otherLine.score)})`
      : null,
    reply
      ? `Sau ${ply.san}, biến tốt nhất của ${opponent}: ${line(ply.fenAfter, reply.pv)} (eval ${formatScore(reply.score)})`
      : `Sau ${ply.san}: ván kết thúc (${formatScore(after.score)})`,
    '',
    BAD.includes(review.class)
      ? `Vì sao ${ply.san} là nước "${label.toLowerCase()}", và lẽ ra nên đi gì?`
      : `Vì sao ${ply.san} được đánh giá là nước "${label.toLowerCase()}"?`,
  ]

  return { system: EXPLAIN_SYSTEM, user: parts.filter((p) => p !== null).join('\n') }
}
