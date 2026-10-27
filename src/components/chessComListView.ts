import type { GameSummary } from '../api/chessCom'
import type { ChessComStatus } from '../hooks/useChessComGames'

export interface ListViewInput {
  status: ChessComStatus
  games: GameSummary[]
  filtered: GameSummary[]
  visible: number
  hasMore: boolean
  error: string | null
}

export interface ListView {
  shown: GameSummary[]
  /** Dòng trạng thái cho người dùng (null: không hiện). */
  message: string | null
  /** Nút "Tải thêm" (đã có ván đang hiện, còn ván để hiện/tải). */
  showMoreButton: boolean
  /** Nút tìm trong tháng cũ hơn (chưa có ván nào khớp nhưng vẫn còn tháng). */
  searchOlderButton: boolean
}

/** Quyết định hiển thị danh sách ván chess.com; tách khỏi JSX để test đủ các tổ hợp trạng thái. */
export function chessComListView({ status, games, filtered, visible, hasMore, error }: ListViewInput): ListView {
  const shown = filtered.slice(0, visible)
  const firstLoad = status === 'loading' && games.length === 0

  let message: string | null = null
  if (firstLoad) message = 'Đang tải ván…'
  else if (!error && shown.length === 0 && status !== 'loading') {
    if (games.length === 0) message = hasMore ? 'Chưa thấy ván cờ vua thường nào trong các tháng gần đây.' : 'Người chơi này chưa có ván nào.'
    else message = hasMore ? 'Chưa thấy ván phù hợp trong các tháng đã tìm.' : 'Không có ván nào phù hợp.'
  }

  return {
    shown,
    message,
    showMoreButton: !error && shown.length > 0 && (filtered.length > visible || hasMore),
    searchOlderButton: !error && !firstLoad && shown.length === 0 && hasMore,
  }
}
