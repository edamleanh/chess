import { useEffect, useRef, useState } from 'react'
import { clearApiKey, looksLikeApiKey, readApiKey, saveApiKey } from '../ai/apiKeyStore'
import { EXPLAIN_MODEL } from '../ai/claudeClient'
import type { ExplainInput } from '../ai/explainPrompt'
import { useMoveExplanation } from '../hooks/useMoveExplanation'

interface AiExplainProps {
  input: ExplainInput
}

const STATUS_TEXT = {
  idle: '',
  streaming: 'Claude đang giải thích…',
  done: 'Đã có lời giải thích.',
  error: '',
} as const

/** Nút "Giải thích bằng AI" + form nhập API key + câu trả lời stream dần. */
export function AiExplain({ input }: AiExplainProps) {
  const [apiKey, setApiKey] = useState<string | null>(readApiKey)
  const [askKey, setAskKey] = useState(false)
  const explanation = useMoveExplanation(input)
  const authFailed = explanation.error?.kind === 'auth'
  const answerRef = useRef<HTMLDivElement>(null)

  // API báo key sai: xóa key đã lưu để lần sau không dùng lại (403 "không đủ quyền" thì giữ key)
  useEffect(() => {
    if (authFailed) clearApiKey()
  }, [authFailed])

  // Bắt đầu giải thích: nút vừa bấm biến mất, chuyển focus sang vùng câu trả lời
  useEffect(() => {
    if (explanation.status === 'streaming') answerRef.current?.focus()
  }, [explanation.status])

  const usableKey = authFailed ? null : apiKey

  function start() {
    if (!usableKey) return setAskKey(true)
    explanation.explain(usableKey)
  }

  function onKeySaved(key: string, remember: boolean) {
    saveApiKey(key, remember)
    setApiKey(key)
    setAskKey(false)
    explanation.explain(key)
  }

  function onCancel() {
    setAskKey(false)
    if (authFailed) {
      setApiKey(null)
      explanation.reset()
    }
  }

  if (askKey || authFailed) {
    return (
      <ApiKeyForm onSave={onKeySaved} onCancel={onCancel} error={authFailed ? explanation.error!.message : null} />
    )
  }

  const { status, text, error, model } = explanation
  const stoppedByUser = error?.kind === 'aborted'

  return (
    <div className="ai">
      {/* Live region luôn có sẵn: chỉ báo trạng thái, không đọc từng token */}
      <p className="visually-hidden" role="status">
        {STATUS_TEXT[status]}
      </p>

      {status === 'idle' && (
        <button type="button" className="ai__button" onClick={start}>
          <span aria-hidden="true">✨ </span>Giải thích bằng AI
        </button>
      )}

      {status !== 'idle' && (
        <div ref={answerRef} tabIndex={-1} className="ai__answer" aria-busy={status === 'streaming'}>
          {text && (
            <p className="ai__text">
              {text}
              {status === 'streaming' && <span className="ai__cursor" aria-hidden="true" />}
            </p>
          )}
          {status === 'streaming' && !text && <p className="ai__muted">Claude đang đọc phân tích…</p>}
        </div>
      )}

      {error &&
        (stoppedByUser ? (
          <p className="ai__muted">Đã dừng.</p>
        ) : (
          <p className="ai__error" role="alert">
            {error.message}
          </p>
        ))}

      {status !== 'idle' && (
        <div className="ai__footer">
          <span>Giải thích bởi Claude ({model ?? EXPLAIN_MODEL}), dựa trên phân tích của Stockfish.</span>
          {status === 'streaming' && (
            <button type="button" onClick={explanation.stop}>
              Dừng
            </button>
          )}
          {status === 'error' && error?.retryable && (
            <button type="button" onClick={start}>
              Thử lại
            </button>
          )}
          {status !== 'streaming' && apiKey && (
            <button type="button" onClick={() => setAskKey(true)}>
              Đổi API key
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface ApiKeyFormProps {
  onSave: (key: string, remember: boolean) => void
  onCancel: () => void
  error: string | null
}

function ApiKeyForm({ onSave, onCancel, error }: ApiKeyFormProps) {
  const [value, setValue] = useState('')
  const [remember, setRemember] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)
  const message = formatError ?? error

  return (
    <form
      className="ai ai__form"
      onSubmit={(e) => {
        e.preventDefault()
        const key = value.trim()
        if (!looksLikeApiKey(key)) return setFormatError('Key Anthropic có dạng "sk-ant-…".')
        onSave(key, remember)
      }}
    >
      <label htmlFor="anthropic-key" className="ai__label">
        API key Anthropic
      </label>
      <input
        id="anthropic-key"
        type="password"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setFormatError(null)
        }}
        placeholder="sk-ant-…"
        autoComplete="off"
        spellCheck={false}
        autoFocus
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? 'anthropic-key-error anthropic-key-note' : 'anthropic-key-note'}
      />
      <label className="ai__remember">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Nhớ trên trình duyệt này
      </label>
      {message && (
        <p id="anthropic-key-error" className="ai__error" role="alert">
          {message}
        </p>
      )}
      <p id="anthropic-key-note" className="ai__muted">
        Key chỉ lưu trong trình duyệt của bạn và được gửi thẳng tới Anthropic. Chi phí tính vào tài khoản của bạn, theo
        số token của mỗi lần giải thích. Tạo key tại{' '}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
          console.anthropic.com<span className="visually-hidden"> (mở tab mới)</span>
        </a>
        .
      </p>
      <div className="ai__actions">
        <button type="submit" className="primary">
          Lưu và giải thích
        </button>
        <button type="button" onClick={onCancel}>
          Hủy
        </button>
      </div>
    </form>
  )
}
