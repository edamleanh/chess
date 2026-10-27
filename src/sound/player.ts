import type { MoveSound } from './moveSound'

// Âm thanh tự tổng hợp bằng Web Audio: không cần file âm thanh (không lo bản quyền, không tải thêm, không đụng CSP).
// Tiếng "gõ quân" = nhiễu trắng tắt nhanh qua bộ lọc band-pass (giống tiếng gỗ); các loại nước khác thêm âm báo.

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
  // Trình duyệt chỉ cho phát sau thao tác của người dùng; phím/click đã là thao tác nên resume được
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise
  const length = Math.floor(c.sampleRate * 0.12)
  noise = c.createBuffer(1, length, c.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

/** Tiếng quân gỗ đặt xuống bàn. `pitch`: tần số trung tâm của bộ lọc (thấp = trầm, nặng). */
function knock(c: AudioContext, at: number, { pitch = 1800, gain = 0.6, decay = 0.07 } = {}) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = pitch
  filter.Q.value = 1.4
  const amp = c.createGain()
  amp.gain.setValueAtTime(gain, at)
  amp.gain.exponentialRampToValueAtTime(0.001, at + decay)
  src.connect(filter).connect(amp).connect(c.destination)
  src.start(at)
  src.stop(at + decay + 0.02)
}

/** Một nốt ngắn (báo chiếu, phong cấp, chiếu hết). */
function tone(c: AudioContext, at: number, freq: number, { duration = 0.12, gain = 0.12, type = 'sine' as OscillatorType } = {}) {
  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  const amp = c.createGain()
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  osc.connect(amp).connect(c.destination)
  osc.start(at)
  osc.stop(at + duration + 0.02)
}

export function playMoveSound(kind: MoveSound) {
  const c = audio()
  if (!c) return
  const t = c.currentTime + 0.005
  switch (kind) {
    case 'move':
      knock(c, t)
      break
    case 'capture':
      // Hai tiếng gõ dồn, trầm và mạnh hơn: quân bị ăn rồi quân đặt xuống
      knock(c, t, { pitch: 1200, gain: 0.8, decay: 0.09 })
      knock(c, t + 0.045, { pitch: 2200, gain: 0.5 })
      break
    case 'castle':
      knock(c, t)
      knock(c, t + 0.11, { pitch: 1500 })
      break
    case 'check':
      knock(c, t)
      tone(c, t + 0.02, 880, { duration: 0.16, gain: 0.1, type: 'triangle' })
      break
    case 'promote':
      knock(c, t)
      tone(c, t + 0.03, 660, { duration: 0.1 })
      tone(c, t + 0.11, 990, { duration: 0.16 })
      break
    case 'mate':
      knock(c, t, { pitch: 1200, gain: 0.8, decay: 0.09 })
      tone(c, t + 0.05, 784, { duration: 0.18 })
      tone(c, t + 0.2, 659, { duration: 0.18 })
      tone(c, t + 0.35, 523, { duration: 0.35 })
      break
  }
}
