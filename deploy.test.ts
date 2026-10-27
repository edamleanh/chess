import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTENT_SECURITY_POLICY } from './vite.config'

const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const rootHeaders = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)')!.headers.map((h) => [h.key, h.value]))

describe('header deploy (vercel.json) khớp với vite preview', () => {
  it('cross-origin isolation cho Stockfish đa luồng', () => {
    expect(rootHeaders['Cross-Origin-Opener-Policy']).toBe('same-origin')
    expect(rootHeaders['Cross-Origin-Embedder-Policy']).toBe('require-corp')
  })

  it('CSP giống hệt bản trong vite.config.ts (đã kiểm tra bằng vite preview)', () => {
    expect(rootHeaders['Content-Security-Policy']).toBe(CONTENT_SECURITY_POLICY)
  })
})
