import { MOVE_CLASS_META } from '../analysis/moveClassMeta'
import { QUALITIES, type QualityId } from '../analysis/quality'
import { MOVE_CLASSES, type GameReview } from '../analysis/reviewGame'
import { poolLabel, type PoolStatus } from '../engine/enginePool'
import type { GameAnalysisStatus } from '../hooks/useGameAnalysis'
import type { Color } from '../types'
import { MoveBadge } from './MoveBadge'

interface ReviewSummaryProps {
  headers: Record<string, string>
  status: GameAnalysisStatus
  analyzed: number
  total: number
  pool: PoolStatus | null
  review: GameReview
  /** Accuracy do chess.com tính, hiện cạnh Accuracy của app để so sánh. */
  reference?: Record<Color, number>
  /** Thời gian trung bình mỗi nước (giây), từ đồng hồ trong PGN. */
  averageTime: Record<Color, number | null>
  sourceUrl?: string
  quality: QualityId
  onQualityChange: (quality: QualityId) => void
}

function header(headers: Record<string, string>, key: string): string | null {
  const v = headers[key]
  return v && v !== '?' ? v : null
}

function progressText(status: GameAnalysisStatus, analyzed: number, total: number, pool: PoolStatus | null): string {
  if (status === 'error') return 'Không phân tích được ván này (không khởi động được engine).'
  if (!pool || (pool.ready === 0 && analyzed <= 1)) {
    const n = pool?.starting ? `${pool.starting} ` : ''
    return `Đang khởi động ${n}engine ${poolLabel(pool?.flavor ?? null)}…`
  }
  return `Đang phân tích ${analyzed}/${total} vị trí · ${pool.ready} engine song song`
}

const fmtSeconds = (s: number | null) => (s === null ? '–' : `${s.toFixed(1)}s`)

/** Thẻ tổng kết ván: 2 người chơi, Accuracy, rating, số nước theo từng nhãn, thời gian trung bình. */
export function ReviewSummary(props: ReviewSummaryProps) {
  const { headers, status, analyzed, total, pool, review, reference, averageTime, sourceUrl, quality, onQualityChange } =
    props
  const white = header(headers, 'White') ?? 'Trắng'
  const black = header(headers, 'Black') ?? 'Đen'
  const accuracy = review.accuracy
  const pct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${v.toFixed(1)}%`)

  return (
    <section className="summary card">
      <div className="summary__players">
        <Avatar name={white} color="w" />
        <span className="summary__vs">vs</span>
        <Avatar name={black} color="b" />
      </div>

      {status !== 'done' && (
        <div className="summary__progress">
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={analyzed}>
            <div className="progress__fill" style={{ width: `${(analyzed / total) * 100}%` }} />
          </div>
          <span className={status === 'error' ? 'summary__error' : 'summary__muted'}>
            {progressText(status, analyzed, total, pool)}
          </span>
        </div>
      )}

      <dl className="summary__stats">
        <Stat label="Accuracy" w={pct(accuracy?.w)} b={pct(accuracy?.b)} big />
        {reference && <Stat label="chess.com" w={pct(reference.w)} b={pct(reference.b)} />}
        <Stat label="Rating" w={header(headers, 'WhiteElo') ?? '–'} b={header(headers, 'BlackElo') ?? '–'} />
      </dl>

      <h3 className="summary__heading">Phân loại nước đi</h3>
      <table className="summary__table">
        <caption className="visually-hidden">Số nước theo từng nhãn: {white} (trái), {black} (phải)</caption>
        <tbody>
          {MOVE_CLASSES.map((c) => (
            <tr key={c}>
              <td className="summary__count summary__count--w">{review.counts.w[c]}</td>
              <th scope="row">
                <MoveBadge cls={c} /> {MOVE_CLASS_META[c].label}
              </th>
              <td className="summary__count summary__count--b">{review.counts.b[c]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(averageTime.w !== null || averageTime.b !== null) && (
        <dl className="summary__stats">
          <Stat label="Thời gian TB/nước" w={fmtSeconds(averageTime.w)} b={fmtSeconds(averageTime.b)} />
        </dl>
      )}

      <div className="summary__footer">
        <label className="summary__quality">
          Độ sâu
          <select value={quality} onChange={(e) => onQualityChange(e.target.value as QualityId)}>
            {Object.values(QUALITIES).map((q) => (
              <option key={q.id} value={q.id}>
                {q.label} ({q.hint})
              </option>
            ))}
          </select>
        </label>
        {sourceUrl && (
          <a className="summary__source" href={sourceUrl} target="_blank" rel="noreferrer">
            chess.com ↗<span className="visually-hidden"> (mở tab mới)</span>
          </a>
        )}
      </div>
    </section>
  )
}

function Avatar({ name, color }: { name: string; color: Color }) {
  return (
    <div className="summary__player">
      <span className={`player__avatar player__avatar--${color} player__avatar--large`} aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="summary__name">{name}</span>
    </div>
  )
}

function Stat({ label, w, b, big }: { label: string; w: string; b: string; big?: boolean }) {
  return (
    <div className={big ? 'stat stat--big' : 'stat'}>
      <dd className="stat__value">{w}</dd>
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value">{b}</dd>
    </div>
  )
}
