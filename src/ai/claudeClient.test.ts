import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { ExplainError, toExplainError } from './claudeClient'

const headers = new Headers()

describe('toExplainError', () => {
  it.each([
    [new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', headers), 'auth', false],
    [new Anthropic.PermissionDeniedError(403, {}, 'forbidden', headers), 'permission', false],
    [new Anthropic.NotFoundError(404, {}, 'model not found', headers), 'model', false],
    [new Anthropic.RateLimitError(429, {}, 'rate limited', headers), 'rate', true],
    [new Anthropic.InternalServerError(500, {}, 'overloaded', headers), 'api', true],
    [new Anthropic.APIConnectionError({ message: 'offline' }), 'network', true],
    [new Anthropic.APIUserAbortError(), 'aborted', true],
    [new Error('boom'), 'unknown', true],
  ])('%o → %s (thử lại được: %s)', (error, kind, retryable) => {
    const mapped = toExplainError(error, Anthropic)
    expect(mapped).toBeInstanceOf(ExplainError)
    expect(mapped.kind).toBe(kind)
    expect(mapped.retryable).toBe(retryable)
  })

  it('chỉ lỗi auth mới là "key sai" (403 không phải lý do để xóa key)', () => {
    expect(toExplainError(new Anthropic.PermissionDeniedError(403, {}, 'x', headers), Anthropic).kind).not.toBe('auth')
  })

  it('giữ nguyên ExplainError có sẵn', () => {
    const e = new ExplainError('refusal', 'AI từ chối')
    expect(toExplainError(e, Anthropic)).toBe(e)
    expect(e.retryable).toBe(false)
  })
})
