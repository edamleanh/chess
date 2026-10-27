import { assess } from '../analysis/assessment'
import { winPercent } from '../analysis/winPercent'
import { formatScore } from '../engine/formatScore'
import type { Score } from '../types'

interface AssessmentBarProps {
  /** Theo góc nhìn Trắng; null khi chưa có đánh giá hoặc engine tắt. */
  score: Score | null
}

/** Phần sáng hẹp hơn mức này thì chữ nằm chủ yếu trên nền tối: đổi sang chữ sáng. */
const DARK_TEXT_BELOW = 35

/**
 * Thanh đánh giá ngang: phần sáng (bên trái) là cơ hội thắng của Trắng, kèm câu mô tả
 * ("Trắng ưu thế", "Đen chiếu hết sau 3 nước"...). Có đòn chiếu hết thì thanh được làm nổi.
 */
export function AssessmentBar({ score }: AssessmentBarProps) {
  const white = score ? winPercent(score) : 50
  const assessment = score ? assess(score) : null

  return (
    <div
      className={['assessment', assessment?.mateIn ? 'assessment--mate' : '', white < DARK_TEXT_BELOW ? 'assessment--dark' : ''].join(' ')}
      role="meter"
      aria-label="Đánh giá thế cờ"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(white)}
      aria-valuetext={assessment?.text ?? 'Chưa có đánh giá'}
    >
      <div className="assessment__fill" style={{ width: `${white}%` }} />
      <span className="assessment__text">{assessment?.text ?? '…'}</span>
      {score && <span className="assessment__score">{formatScore(score)}</span>}
    </div>
  )
}
