import { useState } from 'react'
import { SAMPLE_PGN } from '../chess/samplePgn'

interface PgnInputProps {
  error: string | null
  onLoad: (pgn: string) => void
}

export function PgnInput({ error, onLoad }: PgnInputProps) {
  const [text, setText] = useState('')

  function loadSample() {
    setText(SAMPLE_PGN)
    onLoad(SAMPLE_PGN)
  }

  return (
    <form
      className="pgn-input"
      onSubmit={(e) => {
        e.preventDefault()
        onLoad(text)
      }}
    >
      <label htmlFor="pgn">Dán PGN</label>
      <textarea
        id="pgn"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'[White "..."]\n[Black "..."]\n\n1. e4 e5 2. Nf3 ...'}
        rows={6}
        spellCheck={false}
      />
      {error && (
        <p className="pgn-input__error" role="alert">
          {error}
        </p>
      )}
      <div className="pgn-input__actions">
        <button type="submit" className="primary">
          Tải ván
        </button>
        <button type="button" onClick={loadSample}>
          Ván mẫu
        </button>
      </div>
    </form>
  )
}
