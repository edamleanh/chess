import { useEffect, useState } from 'react'
import { detectOpening, loadOpeningDb, type OpeningInfo } from '../openings/openings'
import type { GameModel } from '../types'

const NONE: OpeningInfo = { bookPlies: 0, opening: null, byPly: [] }

/** Khai cuộc của ván; NONE trong lúc dữ liệu khai cuộc đang tải (chunk riêng). */
export function useOpening(game: GameModel): OpeningInfo {
  const [result, setResult] = useState<{ game: GameModel; info: OpeningInfo } | null>(null)

  useEffect(() => {
    let active = true
    loadOpeningDb().then(
      (db) => {
        if (active) setResult({ game, info: detectOpening(game, db) })
      },
      () => {
        // Không tải được dữ liệu khai cuộc: review vẫn chạy, chỉ thiếu nhãn Book
      },
    )
    return () => {
      active = false
    }
  }, [game])

  return result?.game === game ? result.info : NONE
}
