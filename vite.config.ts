/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Stockfish đa luồng cần SharedArrayBuffer, nên trang phải được cross-origin isolated.
// Khi deploy, vercel.json gửi cùng các header này.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

/**
 * CSP cho bản build (giống vercel.json). Không dùng cho dev server vì Vite dev cần script inline (HMR).
 * Mục đích chính: API key Anthropic có thể nằm trong localStorage, nên chặn script lạ và chỉ cho gọi
 * đúng các API cần thiết.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self' https://api.chess.com https://api.anthropic.com",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'", // style={...} của React/recharts/react-chessboard
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { headers: crossOriginIsolation },
  preview: { headers: { ...crossOriginIsolation, 'Content-Security-Policy': CONTENT_SECURITY_POLICY } },
  build: {
    // Chunk lớn nhất là dữ liệu khai cuộc (~730 KB, ~100 KB gzip), tải lười khi có ván: không phải code cần tách
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'node',
  },
})
