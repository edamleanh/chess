export type QualityId = 'fast' | 'standard' | 'deep'

export interface Quality {
  id: QualityId
  label: string
  /** Mô tả ngắn cho ô chọn. */
  hint: string
  /** Loại engine của pool phân tích cả ván. */
  engine: 'full-single' | 'lite-single'
  movetimeMs: number
  maxDepth: number
}

/**
 * Mức phân tích cả ván. Đo trên ván 108 vị trí, máy 12 nhân:
 * - Nhanh: 11×Lite song song ≈ 7 s; lệch thêm ~4/107 nước về "nước dở hay không" so với Chuẩn.
 * - Chuẩn: 5×Full song song ≈ 16 s; ngang chất lượng Full 11 luồng 1 s/vị trí (≈ 72 s).
 * Mỗi vị trí dừng khi đạt depth hoặc hết thời gian, tùy điều kiện nào đến trước.
 */
export const QUALITIES: Record<QualityId, Quality> = {
  fast: { id: 'fast', label: 'Nhanh', hint: 'Lite song song', engine: 'lite-single', movetimeMs: 1000, maxDepth: 18 },
  standard: { id: 'standard', label: 'Chuẩn', hint: 'Full song song', engine: 'full-single', movetimeMs: 1000, maxDepth: 18 },
  deep: { id: 'deep', label: 'Sâu', hint: 'Full, tối đa 3 s/nước', engine: 'full-single', movetimeMs: 3000, maxDepth: 22 },
}

/** Cần 2 biến chính để nhận ra nước "Great" (nước duy nhất). */
export const BATCH_MULTI_PV = 2
