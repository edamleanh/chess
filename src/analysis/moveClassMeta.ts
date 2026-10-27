import type { MoveClass } from './classifyMove'

export interface MoveClassMeta {
  label: string
  symbol: string
  /** Màu nền badge; `text` là màu chữ đủ tương phản trên nền đó. */
  color: string
  text: string
}

export const MOVE_CLASS_META: Record<MoveClass, MoveClassMeta> = {
  brilliant: { label: 'Thiên tài', symbol: '!!', color: '#1baca6', text: '#ffffff' },
  great: { label: 'Tuyệt vời', symbol: '!', color: '#5c8bb0', text: '#ffffff' },
  best: { label: 'Tốt nhất', symbol: '★', color: '#81b64c', text: '#ffffff' },
  excellent: { label: 'Xuất sắc', symbol: '✓', color: '#96bc4b', text: '#ffffff' },
  good: { label: 'Tốt', symbol: '○', color: '#95af8a', text: '#ffffff' },
  // Ký hiệu chữ thay vì emoji 📖: emoji hiển thị không ổn định trong badge nhỏ
  book: { label: 'Khai cuộc', symbol: '≡', color: '#a88865', text: '#ffffff' },
  inaccuracy: { label: 'Thiếu chính xác', symbol: '?!', color: '#f7c045', text: '#3a2a00' },
  mistake: { label: 'Sai lầm', symbol: '?', color: '#ffa459', text: '#3a1a00' },
  miss: { label: 'Bỏ lỡ', symbol: '✕', color: '#ff7769', text: '#ffffff' },
  blunder: { label: 'Sai lầm nghiêm trọng', symbol: '??', color: '#fa412d', text: '#ffffff' },
}

/** Nhãn đáng đánh dấu trên biểu đồ và gợi ý nước đúng. */
export const NOTABLE_CLASSES: MoveClass[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder']
export const BAD_CLASSES: MoveClass[] = ['inaccuracy', 'mistake', 'miss', 'blunder']
