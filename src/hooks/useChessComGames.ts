import { useCallback, useEffect, useRef, useState } from 'react'
import { ChessComError, type GameSummary } from '../api/chessCom'
import { ChessComLoader } from '../api/chessComLoader'

export type ChessComStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Một lượt tìm. `id` mới cho mỗi lần bấm "Tìm", kể cả cùng username, để luôn tải lại ván mới nhất. */
export interface ChessComSearch {
  id: number
  username: string
}

interface State {
  searchId: number
  status: ChessComStatus
  games: GameSummary[]
  hasMore: boolean
  error: string | null
  /** Lỗi tạm thời (mạng, giới hạn tần suất...): thử lại có thể thành công. */
  retryable: boolean
  /** Tháng cũ nhất đã tìm tới, "MM/YYYY". */
  oldestMonth: string | null
}

type Match = (game: GameSummary) => boolean

const LOADING = (searchId: number): State => ({
  searchId,
  status: 'loading',
  games: [],
  hasMore: true,
  error: null,
  retryable: false,
  oldestMonth: null,
})

/** Danh sách ván chess.com của lượt tìm `search`; null thì không tải gì. */
export function useChessComGames(search: ChessComSearch | null) {
  const [state, setState] = useState<State | null>(null)
  const loaderRef = useRef<{ searchId: number; loader: ChessComLoader } | null>(null)
  /** Loader đang tải; không cho gọi loadMore chồng nhau (sẽ tải trùng một tháng). */
  const busyRef = useRef<ChessComLoader | null>(null)

  /** Tải thêm một lượt; state chỉ được cập nhật khi có kết quả (bất đồng bộ). */
  const load = useCallback((searchId: number, loader: ChessComLoader, match?: Match) => {
    if (busyRef.current === loader) return
    busyRef.current = loader
    const isCurrent = () => loaderRef.current?.loader === loader
    const snapshot = () => ({
      searchId,
      games: loader.games,
      hasMore: loader.hasMore,
      oldestMonth: loader.oldestLoadedMonth,
    })
    loader
      .loadMore(match)
      .then(
        () => {
          if (isCurrent()) setState({ ...snapshot(), status: 'ready', error: null, retryable: false })
        },
        (e: unknown) => {
          if (!isCurrent()) return // đã có lượt tìm mới / abort
          const known = e instanceof ChessComError
          setState({
            ...snapshot(),
            status: 'error',
            error: known ? e.message : 'Có lỗi không mong muốn khi tải ván.',
            retryable: !known || !['invalid', 'not-found'].includes(e.kind),
          })
        },
      )
      .finally(() => {
        if (busyRef.current === loader) busyRef.current = null
      })
  }, [])

  useEffect(() => {
    if (!search) return
    const controller = new AbortController()
    const loader = new ChessComLoader(search.username, (url, init) => fetch(url, init), controller.signal)
    const entry = { searchId: search.id, loader }
    loaderRef.current = entry
    load(search.id, loader)
    return () => {
      controller.abort()
      if (loaderRef.current === entry) loaderRef.current = null
    }
  }, [search, load])

  /** Tải thêm cho tới khi có thêm một trang ván khớp `match` (vd. bộ lọc thể loại đang chọn). */
  const loadMore = useCallback(
    (match?: Match) => {
      const entry = loaderRef.current
      if (!entry || busyRef.current === entry.loader) return
      setState((s) => (s?.searchId === entry.searchId ? { ...s, status: 'loading', error: null } : s))
      load(entry.searchId, entry.loader, match)
    },
    [load],
  )

  // State của lượt tìm khác (kể cả cùng username) không còn đúng: coi như đang tải lần đầu
  const current: State | null = !search ? null : state?.searchId === search.id ? state : LOADING(search.id)

  return {
    status: current?.status ?? 'idle',
    games: current?.games ?? [],
    hasMore: current?.hasMore ?? false,
    error: current?.error ?? null,
    retryable: current?.retryable ?? false,
    oldestMonth: current?.oldestMonth ?? null,
    loadMore,
  }
}
