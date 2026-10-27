import { useCallback, useEffect, useRef, useState } from 'react'
import { explainMove, ExplainError, type ExplainResult } from '../ai/claudeClient'
import { buildExplainPrompt, type ExplainInput } from '../ai/explainPrompt'
import type { PositionEval } from '../types'

export type ExplanationStatus = 'idle' | 'streaming' | 'done' | 'error'

interface State {
  status: ExplanationStatus
  text: string
  /** Model đã trả lời (khi xong). */
  model: string | null
  error: ExplainError | null
}

const IDLE: State = { status: 'idle', text: '', model: null, error: null }

/**
 * Câu trả lời đã nhận, theo eval trước/sau của nước đi. Xem lại nước cũ không phải trả phí lần nữa;
 * phân tích lại (vd. đổi độ sâu) tạo eval mới nên sẽ không dùng nhầm lời giải thích cũ.
 */
const cache = new WeakMap<PositionEval, WeakMap<PositionEval, ExplainResult>>()

/**
 * Giải thích một nước bằng Claude. Component dùng hook này được remount theo từng nước
 * (`key` = ply), nên mỗi instance chỉ phục vụ một nước; unmount thì hủy request đang chạy.
 */
export function useMoveExplanation(input: ExplainInput) {
  const cached = cache.get(input.before)?.get(input.after)
  const [state, setState] = useState<State>(() =>
    cached ? { status: 'done', text: cached.text, model: cached.model, error: null } : IDLE,
  )
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const explain = useCallback(
    (apiKey: string) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const isCurrent = () => controllerRef.current === controller
      let text = ''
      setState({ status: 'streaming', text: '', model: null, error: null })

      explainMove(
        apiKey,
        buildExplainPrompt(input),
        {
          onText: (delta) => {
            text += delta
            if (isCurrent()) setState({ status: 'streaming', text, model: null, error: null })
          },
          onReset: () => {
            text = ''
            if (isCurrent()) setState({ status: 'streaming', text: '', model: null, error: null })
          },
        },
        controller.signal,
      ).then(
        (result) => {
          let perBefore = cache.get(input.before)
          if (!perBefore) cache.set(input.before, (perBefore = new WeakMap()))
          perBefore.set(input.after, result)
          if (isCurrent()) setState({ status: 'done', text: result.text, model: result.model, error: null })
        },
        (e: unknown) => {
          if (!isCurrent()) return
          const error = e instanceof ExplainError ? e : new ExplainError('unknown', String(e))
          setState({ status: 'error', text, model: null, error })
        },
      )
    },
    [input],
  )

  const stop = useCallback(() => controllerRef.current?.abort(), [])

  /** Bỏ trạng thái lỗi (vd. người dùng hủy form nhập key), quay về nút "Giải thích". */
  const reset = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setState(IDLE)
  }, [])

  return { ...state, explain, stop, reset }
}
