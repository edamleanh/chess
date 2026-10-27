// Mọi ngưỡng chấm nước đi, theo cách chess.com công bố (support.chess.com, "How are moves classified?").
// Đơn vị: điểm win% (0–100) theo góc nhìn người vừa đi; 1 điểm = 0.01 "expected points" của chess.com.
// Giải thích chi tiết và các chỗ chess.com không công bố: docs/scoring.md.

/** Mức mất "expected points" tối đa cho từng nhãn (0.02 / 0.05 / 0.10 / 0.20 của chess.com); hơn nữa là Blunder. */
export const EXCELLENT_MAX_DROP = 2
export const GOOD_MAX_DROP = 5
export const INACCURACY_MAX_DROP = 10
export const MISTAKE_MAX_DROP = 20

/**
 * Vùng kết quả (thua / cân bằng / thắng) theo cơ hội thắng của người đi, dùng cho Great và Miss.
 * chess.com nói ranh giới này thay đổi theo rating nhưng không công bố số: chia đều 3 vùng.
 * win% 67 ≈ hơn khoảng +2 Tốt.
 */
export const LOSING_BELOW = 33
export const WINNING_ABOVE = 67

/** Brilliant: thí quân, là nước tốt nhất hoặc gần như vậy, sau đó không bị xấu thế. */
export const BRILLIANT_MAX_DROP = 2
export const BRILLIANT_MIN_WIN_AFTER = 50

/** Brilliant: không tính nếu không cần nước thí quân cũng đã thắng tuyệt đối. */
export const CRUSHING_WIN = 97
