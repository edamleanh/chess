/** Gợi ý ô đi được của quân đang chọn: chấm (ô trống) hoặc vòng tròn (ăn quân), nằm trên quân cờ. */
export function MoveHint({ kind }: { kind: 'move' | 'capture' | undefined }) {
  if (!kind) return null
  return <span className={`board-square__hint board-square__hint--${kind}`} aria-hidden="true" />
}
