---
name: next-phase
description: Bắt đầu giai đoạn tiếp theo trong lộ trình của CLAUDE.md (GĐ1–GĐ5). Gồm lập kế hoạch, code, test, review và commit. Dùng khi người dùng nói "làm giai đoạn tiếp", "GĐ2", "next phase".
---

# Làm giai đoạn tiếp theo

1. Đọc mục **Lộ trình** trong CLAUDE.md để tìm giai đoạn đầu tiên chưa tick (hoặc giai đoạn người dùng chỉ định).
2. Vào **Plan mode**: liệt kê file sẽ tạo/sửa, thư viện cần cài, rủi ro. Chờ người dùng duyệt.
3. Code theo kế hoạch, theo đúng kiến trúc và quy ước trong CLAUDE.md.
4. Viết unit test cho mọi logic thuần (`src/chess`, `src/analysis`).
5. Gọi subagent `test-runner`. Nếu có sửa `src/analysis` hoặc `src/engine`, gọi thêm `chess-logic-reviewer`, rồi xử lý các vấn đề được báo.
6. Cập nhật CLAUDE.md: tick giai đoạn, sửa mục Kiến trúc nếu có thay đổi.
7. Đề xuất commit message (`feat: GĐx ...`) và chỉ commit khi người dùng đồng ý.
