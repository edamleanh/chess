import { Chess, type Square } from 'chess.js'
import { useMemo, useState, type CSSProperties } from 'react'
import { Chessboard } from 'react-chessboard'
import type { MoveClass } from '../analysis/classifyMove'
import { MOVE_CLASS_META } from '../analysis/moveClassMeta'
import { useDropSquare } from '../hooks/useDropSquare'
import { MARK_STYLE, useSquareMarks } from '../hooks/useSquareMarks'
import type { Ply } from '../types'
import { MoveBadge } from './MoveBadge'
import { MoveHint } from './MoveHint'
import { PromotionPicker } from './PromotionPicker'

export type Orientation = 'white' | 'black'

export interface BoardArrow {
  /** Nước dạng UCI. */
  uci: string
  color: string
}

interface BoardProps {
  fen: string
  /** Nước vừa đi (chỉ cần ô đi / ô đến). */
  lastMove: Pick<Ply, 'from' | 'to'> | null
  /** id của react-chessboard; mỗi bàn cờ đang mount cần id riêng. */
  id?: string
  /** Nhãn của nước vừa đi: tô màu ô và gắn huy hiệu ở ô đích. */
  lastMoveClass?: MoveClass | null
  orientation: Orientation
  arrows?: BoardArrow[]
  /** Người dùng đi một nước (UCI); trả false nếu không hợp lệ. Không truyền thì bàn cờ chỉ để xem. */
  onMove?: (uci: string) => boolean
}

const DEFAULT_LAST_MOVE_COLOR = 'rgba(255, 214, 0, 0.45)'
const SELECTED_STYLE: CSSProperties = { backgroundColor: 'rgba(20, 85, 30, 0.45)' }

/** Nước đi từ `from` tới `to` là phong cấp (hợp lệ) nên phải hỏi người dùng chọn quân. */
function isPromotion(chess: Chess, from: string, to: string): boolean {
  return chess.moves({ square: from as Square, verbose: true }).some((m) => m.to === to && m.isPromotion())
}

export function Board({ fen, lastMove, lastMoveClass, orientation, arrows = [], onMove, id = 'review-board' }: BoardProps) {
  const chess = useMemo(() => new Chess(fen), [fen])
  // Ô đang chọn (bấm-bấm để đi quân); gắn với fen để tự bỏ chọn khi vị trí đổi
  const [selection, setSelection] = useState<{ fen: string; square: string } | null>(null)
  const selected = selection?.fen === fen ? selection.square : null
  // Nước phong cấp đang chờ người dùng chọn quân
  const [promotion, setPromotion] = useState<{ fen: string; from: string; to: string } | null>(null)
  const pendingPromotion = promotion?.fen === fen ? promotion : null

  const targets = useMemo(
    () => (selected ? chess.moves({ square: selected as Square, verbose: true }) : []),
    [chess, selected],
  )

  const lastColor = lastMoveClass ? `${MOVE_CLASS_META[lastMoveClass].color}99` : DEFAULT_LAST_MOVE_COLOR
  const squareStyles: Record<string, CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove.from] = { backgroundColor: lastColor }
    squareStyles[lastMove.to] = { backgroundColor: lastColor }
  }
  const { marks, toggle: toggleMark, clear: clearMarks } = useSquareMarks(fen)
  for (const sq of marks) squareStyles[sq] = MARK_STYLE
  if (selected) squareStyles[selected] = SELECTED_STYLE
  // Chấm nước đi / vòng ăn quân vẽ ở lớp trên quân cờ (nền ô bị quân che mất)
  const hints = new Map(targets.map((m) => [m.to, m.captured ? ('capture' as const) : ('move' as const)]))

  const ownPiece = (square: string) => chess.get(square as Square)?.color === chess.turn()

  function tryMove(from: string, to: string): boolean {
    if (!onMove) return false
    setSelection(null)
    if (isPromotion(chess, from, to)) {
      setPromotion({ fen, from, to })
      return false // quân về chỗ cũ cho tới khi chọn xong quân phong cấp
    }
    return onMove(`${from}${to}`)
  }

  function promote(piece: string) {
    if (!pendingPromotion || !onMove) return
    setPromotion(null)
    onMove(`${pendingPromotion.from}${pendingPromotion.to}${piece}`)
  }

  function onSquareClick(square: string) {
    clearMarks()
    if (!onMove) return
    if (selected && targets.some((m) => m.to === square)) return void tryMove(selected, square)
    setSelection(ownPiece(square) && square !== selected ? { fen, square } : null)
  }

  const badgeSquare = lastMove && lastMoveClass ? lastMove.to : null
  const dropSquare = useDropSquare(id, orientation)

  return (
    <div className="board" onContextMenu={(e) => e.preventDefault()}>
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          allowDragging: Boolean(onMove),
          canDragPiece: ({ piece }) => piece.pieceType[0] === chess.turn(),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            const target = dropSquare(targetSquare)
            return target && target !== sourceSquare ? tryMove(sourceSquare, target) : false
          },
          onSquareClick: ({ square }) => onSquareClick(square),
          // Chuột phải: bấm vào ô để đánh dấu, kéo để vẽ mũi tên; bấm chuột trái để xóa
          onSquareRightClick: ({ square }) => toggleMark(square),
          allowDrawingArrows: true,
          squareStyles,
          squareRenderer: ({ square, children }) => (
            // Có squareRenderer thì react-chessboard không tự áp squareStyles: phải áp ở đây
            <div className="board-square" style={squareStyles[square]}>
              {children}
              <MoveHint kind={hints.get(square as Square)} />
              {square === badgeSquare && lastMoveClass && (
                <span className="board-square__badge">
                  <MoveBadge cls={lastMoveClass} />
                </span>
              )}
            </div>
          ),
          arrows: arrows.map((a) => ({ startSquare: a.uci.slice(0, 2), endSquare: a.uci.slice(2, 4), color: a.color })),
          animationDurationInMs: 150,
        }}
      />
      {pendingPromotion && (
        <PromotionPicker
          color={chess.turn()}
          square={pendingPromotion.to}
          orientation={orientation}
          onPick={promote}
          onCancel={() => setPromotion(null)}
        />
      )}
    </div>
  )
}
