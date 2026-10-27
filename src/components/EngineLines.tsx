import { useMemo } from 'react'
import { pvToSan } from '../chess/pvToSan'
import type { EngineStatus } from '../engine/engineManager'
import { FLAVORS } from '../engine/flavors'
import { formatScore } from '../engine/formatScore'
import type { LiveAnalysis } from '../hooks/useEngineAnalysis'

const PV_PREVIEW = 8

function engineLabel(status: EngineStatus): string {
  if (status.error) return status.error
  if (!status.flavor) return 'đang khởi động…'
  const name = FLAVORS[status.flavor].label
  const threads = status.threads > 1 ? ` · ${status.threads} luồng` : ''
  const loading = status.loadingFull ? ' · đang tải bản Full…' : ''
  return name + threads + loading
}

interface EngineStatusRowProps {
  analysis: LiveAnalysis
  status: EngineStatus
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

/** Dòng trạng thái engine phân tích live: công tắc bật/tắt, độ sâu, tên engine. */
export function EngineStatusRow({ analysis, status, enabled, onToggle }: EngineStatusRowProps) {
  return (
    <section className="engine-row card">
      <span className="engine-row__title">Engine</span>
      {enabled && analysis.depth !== null && <span className="engine-row__depth">d{analysis.depth}</span>}
      <span className="engine-row__name">{engineLabel(status)}</span>
      <label className="switch">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        <span className="switch__track" aria-hidden="true" />
        <span className="visually-hidden">Bật/tắt phân tích live</span>
      </label>
    </section>
  )
}

interface EngineLinesProps {
  fen: string
  analysis: LiveAnalysis
  enabled: boolean
}

/** Eval và biến chính của vị trí đang xem. */
export function EngineLines({ fen, analysis, enabled }: EngineLinesProps) {
  const pvSan = useMemo(() => pvToSan(fen, analysis.pv.slice(0, PV_PREVIEW)), [fen, analysis.pv])
  if (!enabled || analysis.gameOver) return null

  return (
    <section className="engine" aria-live="polite">
      <strong className="engine__score">{analysis.score ? formatScore(analysis.score) : '…'}</strong>
      <span className="engine__pv">
        {pvSan.length > 0 && <strong>{pvSan[0]}</strong>} {pvSan.slice(1).join(' ')}
      </span>
    </section>
  )
}
