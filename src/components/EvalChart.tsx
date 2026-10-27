import { useState, type MouseEvent } from 'react'
import { Area, AreaChart, Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MoveReview } from '../analysis/classifyMove'
import { MOVE_CLASS_META, NOTABLE_CLASSES } from '../analysis/moveClassMeta'
import { winPercent } from '../analysis/winPercent'
import { formatScore } from '../engine/formatScore'
import type { PositionEval, Ply } from '../types'

interface EvalChartProps {
  plies: Ply[]
  evals: (PositionEval | null)[]
  reviews: (MoveReview | null)[]
  /** Thời gian dùng cho mỗi nước (giây); null khi PGN không có đồng hồ. */
  times: (number | null)[]
  ply: number
  onSelect: (ply: number) => void
}

interface Point {
  ply: number
  /** win% của Trắng; null khi vị trí chưa được phân tích (tạo khoảng trống trên biểu đồ). */
  win: number | null
  label: string
  eval: string
  review: MoveReview | null
}

const SURFACE = '#241f1b'
const LIGHT = '#e9dcc6'
const DARK_BAR = '#8a7560'
const CURSOR = '#c9a26b'
const HEIGHT = 130

function moveLabel(p: Ply): string {
  return `${p.moveNumber}${p.color === 'w' ? '.' : '...'} ${p.san}`
}

type Tab = 'eval' | 'time'

/** Biểu đồ theo từng nước: tab Đánh giá (win% của Trắng) và tab Thời gian (giây mỗi nước). Bấm để nhảy tới nước. */
export function EvalChart({ plies, evals, reviews, times, ply, onSelect }: EvalChartProps) {
  const [tab, setTab] = useState<Tab>('eval')
  const hasTimes = times.some((t) => t !== null)

  // Tự tính ply từ tọa độ click: trạng thái tooltip của recharts có thể chưa cập nhật lúc click.
  // Biểu đồ không có lề ngang nên trục x phủ đúng bề rộng khung.
  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    onSelect(Math.round(Math.min(Math.max(ratio, 0), 1) * plies.length))
  }

  return (
    <section className="chart card">
      <div className="chart__tabs" role="tablist" aria-label="Biểu đồ">
        <button type="button" role="tab" aria-selected={tab === 'eval'} onClick={() => setTab('eval')}>
          Đánh giá
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'time'}
          onClick={() => setTab('time')}
          disabled={!hasTimes}
          title={hasTimes ? undefined : 'PGN không có thông tin đồng hồ'}
        >
          Thời gian
        </button>
      </div>
      <div className="chart__body" onClick={handleClick}>
        {tab === 'eval' || !hasTimes ? (
          <EvalArea plies={plies} evals={evals} reviews={reviews} ply={ply} />
        ) : (
          <TimeBars plies={plies} times={times} ply={ply} />
        )}
      </div>
    </section>
  )
}

function EvalArea({ plies, evals, reviews, ply }: Pick<EvalChartProps, 'plies' | 'evals' | 'reviews' | 'ply'>) {
  const data: Point[] = evals.map((e, i) => ({
    ply: i,
    win: e ? winPercent(e.score) : null,
    label: i === 0 ? 'Thế cờ ban đầu' : moveLabel(plies[i - 1]),
    eval: e ? formatScore(e.score) : '…',
    review: i > 0 ? reviews[i - 1] : null,
  }))

  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 6, left: 0 }}>
        <XAxis dataKey="ply" type="number" domain={[0, plies.length]} hide />
        <YAxis domain={[0, 100]} hide />
        <ReferenceLine y={50} stroke="#5a4f45" strokeWidth={1} />
        <Area
          type="linear"
          dataKey="win"
          baseValue={0}
          stroke={LIGHT}
          strokeWidth={2}
          fill={LIGHT}
          fillOpacity={0.85}
          isAnimationActive={false}
          dot={renderDot}
          activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2, fill: LIGHT }}
        />
        <ReferenceLine x={ply} stroke={CURSOR} strokeWidth={2} />
        <Tooltip content={<EvalTooltip />} cursor={{ stroke: '#a3a29d', strokeWidth: 1 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface TimePoint {
  ply: number
  /** Trắng: số giây (dương); Đen: số giây đổi dấu (âm) để vẽ xuống dưới trục. */
  value: number | null
  seconds: number | null
  label: string
  color: 'w' | 'b'
}

function TimeBars({ plies, times, ply }: Pick<EvalChartProps, 'plies' | 'times' | 'ply'>) {
  const data: TimePoint[] = plies.map((p, i) => ({
    ply: i + 1,
    value: times[i] === null ? null : p.color === 'w' ? times[i] : -(times[i] as number),
    seconds: times[i],
    label: moveLabel(p),
    color: p.color,
  }))
  const max = Math.max(1, ...times.map((t) => t ?? 0))

  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: 6, right: 0, bottom: 6, left: 0 }} barCategoryGap={1}>
        <XAxis dataKey="ply" type="number" domain={[0.5, plies.length + 0.5]} hide />
        <YAxis domain={[-max, max]} hide />
        <ReferenceLine y={0} stroke="#5a4f45" strokeWidth={1} />
        <Bar
          dataKey="value"
          isAnimationActive={false}
          shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: TimePoint }) => {
            const { x = 0, y = 0, width = 0, height = 0, payload } = props
            // recharts cho height âm với cột hướng xuống
            const top = height < 0 ? y + height : y
            return (
              <rect
                x={x}
                y={top}
                width={Math.max(1, width)}
                height={Math.abs(height)}
                rx={1}
                fill={payload?.color === 'w' ? LIGHT : DARK_BAR}
              />
            )
          }}
        />
        <ReferenceLine x={ply} stroke={CURSOR} strokeWidth={2} />
        <Tooltip content={<TimeTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface DotProps {
  cx?: number
  cy?: number
  payload?: Point
}

/** Chỉ chấm các nước đáng chú ý, có viền màu nền để nổi trên đường. */
function renderDot({ cx, cy, payload }: DotProps) {
  const cls = payload?.review?.class
  if (cx === undefined || cy === undefined || !cls || !NOTABLE_CLASSES.includes(cls)) {
    return <g key={`dot-${payload?.ply}`} />
  }
  return (
    <circle
      key={`dot-${payload?.ply}`}
      cx={cx}
      cy={cy}
      r={4}
      fill={MOVE_CLASS_META[cls].color}
      stroke={SURFACE}
      strokeWidth={2}
    />
  )
}

interface TooltipProps<T> {
  active?: boolean
  payload?: { payload: T }[]
}

function EvalTooltip({ active, payload }: TooltipProps<Point>) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  const meta = point.review ? MOVE_CLASS_META[point.review.class] : null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__move">{point.label}</div>
      <div className="chart-tooltip__row">
        <strong>{point.eval}</strong>
        {meta && (
          <span className="chart-tooltip__class">
            <span className="chart-tooltip__swatch" style={{ background: meta.color }} />
            {meta.label}
          </span>
        )}
      </div>
    </div>
  )
}

function TimeTooltip({ active, payload }: TooltipProps<TimePoint>) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__move">{point.label}</div>
      <strong>{point.seconds === null ? '–' : `${point.seconds.toFixed(1)} s`}</strong>
    </div>
  )
}
