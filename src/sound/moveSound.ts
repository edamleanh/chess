export type MoveSound = 'move' | 'capture' | 'castle' | 'check' | 'promote' | 'mate'

/** Loại âm thanh của một nước, đọc từ ký hiệu SAN (ưu tiên: chiếu hết > chiếu > phong cấp > nhập thành > ăn quân). */
export function moveSoundKind(san: string): MoveSound {
  if (san.endsWith('#')) return 'mate'
  if (san.endsWith('+')) return 'check'
  if (san.includes('=')) return 'promote'
  if (san.startsWith('O-O')) return 'castle'
  if (san.includes('x')) return 'capture'
  return 'move'
}
