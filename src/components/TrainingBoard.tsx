import { Chess, type Square } from 'chess.js'
import { useMemo, useState, type CSSProperties } from 'react'
import { Chessboard } from 'react-chessboard'
import { useDropSquare } from '../hooks/useDropSquare'
import { MARK_STYLE, useSquareMarks } from '../hooks/useSquareMarks'
import { premoveNeedsPromotion, premoveTargets, type Premove } from '../training/premove'
import type { LastMove } from '../training/session'
import type { Color } from '../types'
import type { MoveClass } from '../analysis/classifyMove'
import { MoveBadge } from './MoveBadge'
import { MoveHint } from './MoveHint'
import { PromotionPicker } from './PromotionPicker'

interface TrainingBoardProps {
  /** Thế cờ thật. */
  fen: string
  /** Thế cờ hiển thị: khác `fen` khi có premove (quân của người chơi ở vị trí ảo). */
  displayFen: string
  player: Color
  lastMove: LastMove | null
  /** Nhãn nước vừa đi (huy hiệu ở ô đích, như màn review). */
  lastMoveClass?: MoveClass | null
  premoves: Premove[]
  /** Tới lượt người chơi: đi nước thật. */
  canMove: boolean
  /** Lượt đối phương: kéo quân là premove. */
  canPremove: boolean
  onMove: (uci: string) => boolean
  onPremove: (premove: Premove) => boolean
  onClearPremoves: () => void
}

const LAST_MOVE: CSSProperties = { backgroundColor: 'rgba(255, 214, 0, 0.45)' }
const PREMOVE: CSSProperties = { backgroundColor: 'rgba(214, 64, 52, 0.6)' }
const SELECTED: CSSProperties = { backgroundColor: 'rgba(20, 85, 30, 0.45)' }

/** Bàn cờ luyện tập: đi quân trong lượt mình, xếp nhiều premove trong lượt đối phương (chuột phải để hủy). */
export function TrainingBoard(props: TrainingBoardProps) {
  const { fen, displayFen, player, lastMove, lastMoveClass, premoves, canMove, canPremove, onMove, onPremove, onClearPremoves } = props
  const chess = useMemo(() => new Chess(fen), [fen])
  const [selection, setSelection] = useState<{ fen: string; square: string } | null>(null)
  const selected = selection?.fen === displayFen ? selection.square : null
  const [promotion, setPromotion] = useState<{ fen: string; from: string; to: string; premove: boolean } | null>(null)
  // Chọn quân phong cấp cho premove: giữ bảng chọn cả khi đối phương đi trong lúc đang chọn
  const pendingPromotion = promotion && (promotion.premove || promotion.fen === displayFen) ? promotion : null

  const targets = useMemo((): string[] => {
    if (!selected) return []
    if (canMove) return chess.moves({ square: selected as Square, verbose: true }).map((m) => m.to)
    return canPremove ? premoveTargets(displayFen, selected) : []
  }, [chess, selected, canMove, canPremove, displayFen])

  const squareStyles: Record<string, CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove.from] = LAST_MOVE
    squareStyles[lastMove.to] = LAST_MOVE
  }
  // Dấu chuột phải gắn với thế cờ thật: tự xóa khi có nước đi
  const { marks, toggle: toggleMark, clear: clearMarks } = useSquareMarks(fen)
  for (const sq of marks) squareStyles[sq] = MARK_STYLE
  for (const p of premoves) {
    squareStyles[p.from] = PREMOVE
    squareStyles[p.to] = PREMOVE
  }
  if (selected) squareStyles[selected] = SELECTED
  // Chấm nước đi / vòng ăn quân vẽ ở lớp trên quân cờ (nền ô bị quân che mất)
  const occupied = new Chess(displayFen)
  const hints = new Map(targets.map((sq) => [sq, occupied.get(sq as Square) ? ('capture' as const) : ('move' as const)]))

  const ownPiece = (square: string) => new Chess(displayFen).get(square as Square)?.color === player

  function tryMove(from: string, to: string): boolean {
    setSelection(null)
    if (canMove) {
      const legal = chess.moves({ square: from as Square, verbose: true }).filter((m) => m.to === to)
      if (legal.length === 0) return false
      if (legal.some((m) => m.isPromotion())) {
        setPromotion({ fen: displayFen, from, to, premove: false })
        return false
      }
      return onMove(`${from}${to}`)
    }
    if (canPremove) {
      if (!premoveTargets(displayFen, from).includes(to)) return false
      if (premoveNeedsPromotion(displayFen, from, to)) {
        setPromotion({ fen: displayFen, from, to, premove: true })
        return false
      }
      return onPremove({ from, to })
    }
    return false
  }

  function promote(piece: string) {
    if (!pendingPromotion) return
    setPromotion(null)
    const { from, to } = pendingPromotion
    // Đối phương đã đi xong trong lúc chọn quân thì đi luôn nước thật; còn chờ thì xếp premove
    if (canMove) onMove(`${from}${to}${piece}`)
    else if (canPremove) onPremove({ from, to, promotion: piece })
  }

  function onSquareClick(square: string) {
    clearMarks()
    if (!canMove && !canPremove) return
    if (selected && targets.includes(square)) return void tryMove(selected, square)
    setSelection(ownPiece(square) && square !== selected ? { fen: displayFen, square } : null)
  }

  /** Chuột phải vào ô: đang có premove thì hủy premove (như chess.com), không thì đánh dấu / bỏ dấu ô. */
  const dropSquare = useDropSquare('training-board', player === 'w' ? 'white' : 'black')

  function onRightClick(square: string) {
    setSelection(null)
    if (premoves.length) onClearPremoves()
    else toggleMark(square)
  }

  return (
    <div className="board" onContextMenu={(e) => e.preventDefault()}>
      <Chessboard
        options={{
          id: 'training-board',
          position: displayFen,
          boardOrientation: player === 'w' ? 'white' : 'black',
          allowDragging: canMove || canPremove,
          canDragPiece: ({ piece }) => piece.pieceType[0] === player,
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            const target = dropSquare(targetSquare)
            return target && target !== sourceSquare ? tryMove(sourceSquare, target) : false
          },
          onSquareClick: ({ square }) => onSquareClick(square),
          onSquareRightClick: ({ square }) => onRightClick(square),
          // Kéo chuột phải để vẽ mũi tên; mũi tên tự xóa khi bấm chuột trái hoặc có nước đi
          allowDrawingArrows: true,
          squareStyles,
          // Có squareRenderer thì react-chessboard không tự áp squareStyles: phải áp ở đây
          squareRenderer: ({ square, children }) => (
            <div className="board-square" style={squareStyles[square]}>
              {children}
              <MoveHint kind={hints.get(square)} />
              {lastMoveClass && square === lastMove?.to && (
                <span className="board-square__badge">
                  <MoveBadge cls={lastMoveClass} />
                </span>
              )}
            </div>
          ),
          // Premove: quân đã được thả ở ô đích, không animate để kéo tiếp ngay (animation đang chạy làm mất lượt kéo)
          animationDurationInMs: premoves.length ? 0 : 120,
        }}
      />
      {pendingPromotion && (
        <PromotionPicker
          color={player}
          square={pendingPromotion.to}
          orientation={player === 'w' ? 'white' : 'black'}
          onPick={promote}
          onCancel={() => setPromotion(null)}
        />
      )}
    </div>
  )
}
