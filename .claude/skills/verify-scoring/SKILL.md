---
name: verify-scoring
description: Kiểm tra logic chấm điểm bằng giá trị chuẩn và ván mẫu đã biết kết quả. Dùng sau khi chỉnh công thức, ngưỡng phân loại hoặc phần parse Stockfish.
---

# Kiểm tra chấm điểm

1. Chạy riêng test của `src/analysis`: `npm test -- --run src/analysis`.
2. Kiểm tra nhanh các giá trị chuẩn của công thức:
   - `winPercent(0)` = 50
   - `winPercent(100)` ≈ 59.1, `winPercent(-100)` ≈ 40.9
   - accuracy khi drop = 0 thì ≈ 100 (được kẹp)
3. Nếu có ván mẫu trong `src/analysis/__fixtures__/` (ví dụ Scholar's mate, trong đó Đen có Blunder rõ ràng), đối chiếu nhãn phân loại với kỳ vọng.
4. Gọi subagent `chess-logic-reviewer` để review.
5. Báo cáo: giá trị nào lệch, lệch bao nhiêu, nghi ngờ nguyên nhân gì.
