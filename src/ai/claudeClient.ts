import type { ExplainPrompt } from './explainPrompt'

/** Model mặc định theo khuyến nghị hiện tại của Anthropic. */
export const EXPLAIN_MODEL = 'claude-opus-5-5'

export type ExplainErrorKind =
  | 'aborted' // người dùng bấm dừng
  | 'auth' // API key sai: phải nhập lại key
  | 'permission' // key đúng nhưng không được dùng model này: giữ key
  | 'model' // model không tồn tại với tài khoản này
  | 'rate' // giới hạn tần suất
  | 'network'
  | 'load' // không tải được thư viện SDK
  | 'refusal'
  | 'truncated' // hết max_tokens giữa chừng
  | 'api'
  | 'unknown'

const RETRYABLE: ExplainErrorKind[] = ['aborted', 'rate', 'network', 'load', 'truncated', 'api', 'unknown']

export class ExplainError extends Error {
  readonly kind: ExplainErrorKind
  constructor(kind: ExplainErrorKind, message: string) {
    super(message)
    this.name = 'ExplainError'
    this.kind = kind
  }

  get retryable(): boolean {
    return RETRYABLE.includes(this.kind)
  }
}

export interface ExplainResult {
  text: string
  /** Model thực sự trả lời (khác EXPLAIN_MODEL nếu server đã chuyển sang model dự phòng). */
  model: string
}

export interface ExplainCallbacks {
  onText: (delta: string) => void
  /** Server chuyển sang model dự phòng: phần chữ đã stream của model trước bị bỏ. */
  onReset: () => void
}

type AnthropicModule = typeof import('@anthropic-ai/sdk').default

/**
 * Gọi Claude giải thích một nước đi, stream từng đoạn chữ qua `onText`.
 * Gọi thẳng từ trình duyệt bằng API key của chính người dùng (không có backend), nên SDK cần
 * `dangerouslyAllowBrowser`. SDK chỉ được tải khi người dùng bấm giải thích.
 */
export async function explainMove(
  apiKey: string,
  prompt: ExplainPrompt,
  { onText, onReset }: ExplainCallbacks,
  signal: AbortSignal,
): Promise<ExplainResult> {
  let Anthropic: AnthropicModule
  try {
    Anthropic = (await import('@anthropic-ai/sdk')).default
  } catch {
    throw new ExplainError('load', 'Không tải được thư viện AI. Kiểm tra mạng rồi thử lại.')
  }

  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    const stream = client.beta.messages.stream(
      {
        model: EXPLAIN_MODEL,
        max_tokens: 16000,
        output_config: { effort: 'medium' },
        // Bị bộ lọc an toàn từ chối thì server tự chạy lại trên model dự phòng phù hợp
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      },
      { signal },
    )
    stream.on('text', onText)
    stream.on('streamEvent', (event) => {
      if (event.type === 'content_block_start' && event.content_block.type === 'fallback') onReset()
    })
    const message = await stream.finalMessage()

    if (message.stop_reason === 'refusal') throw new ExplainError('refusal', 'AI từ chối giải thích nước này.')
    if (message.stop_reason === 'max_tokens') {
      throw new ExplainError('truncated', 'Câu trả lời bị cắt giữa chừng. Thử lại nhé.')
    }
    // Chỉ lấy phần chữ sau khối fallback cuối cùng (phần của model đã trả lời xong)
    const lastFallback = message.content.findLastIndex((b) => b.type === 'fallback')
    const text = message.content
      .slice(lastFallback + 1)
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('')
    return { text, model: message.model }
  } catch (e) {
    throw toExplainError(e, Anthropic)
  }
}

/** Đổi lỗi của SDK sang ExplainError, theo class cụ thể nhất trước. */
export function toExplainError(e: unknown, Anthropic: AnthropicModule): ExplainError {
  if (e instanceof ExplainError) return e
  if (e instanceof Anthropic.APIUserAbortError) return new ExplainError('aborted', 'Đã dừng.')
  if (e instanceof Anthropic.AuthenticationError) return new ExplainError('auth', 'API key không hợp lệ.')
  if (e instanceof Anthropic.PermissionDeniedError) {
    return new ExplainError('permission', 'API key này không được phép dùng model của tính năng giải thích.')
  }
  if (e instanceof Anthropic.NotFoundError) {
    return new ExplainError('model', `Tài khoản này chưa dùng được model ${EXPLAIN_MODEL}.`)
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new ExplainError('rate', 'Đã chạm giới hạn tần suất của API. Đợi một lát rồi thử lại.')
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new ExplainError('network', 'Không kết nối được tới Anthropic. Kiểm tra mạng rồi thử lại.')
  }
  if (e instanceof Anthropic.APIError) {
    return new ExplainError('api', `Lỗi từ API (${e.status ?? '?'}): ${e.message}`)
  }
  return new ExplainError('unknown', 'Có lỗi không mong muốn khi gọi AI.')
}
