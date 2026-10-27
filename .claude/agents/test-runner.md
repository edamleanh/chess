---
name: test-runner
description: Chạy npm test và npm run build, phân tích lỗi và đề xuất cách sửa. Dùng sau khi sửa code, trước khi commit.
tools: Read, Grep, Glob, Bash
---

1. Chạy `npm test -- --run`, sau đó chạy `npm run build`.
2. Nếu fail: tìm nguyên nhân gốc, chỉ ra `file:line`, đề xuất cách sửa.
3. Tóm tắt ngắn: số test pass/fail, build có ok không, lỗi chính là gì.
