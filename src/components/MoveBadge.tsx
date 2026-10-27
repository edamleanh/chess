import type { MoveClass } from '../analysis/classifyMove'
import { MOVE_CLASS_META } from '../analysis/moveClassMeta'

/** Huy hiệu ký hiệu nhãn nước đi; tên nhãn nằm trong title/aria-label để không phụ thuộc màu. */
export function MoveBadge({ cls }: { cls: MoveClass }) {
  const meta = MOVE_CLASS_META[cls]
  return (
    <span
      className="move-badge"
      style={{ background: meta.color, color: meta.text }}
      title={meta.label}
      aria-label={meta.label}
    >
      {meta.symbol}
    </span>
  )
}
