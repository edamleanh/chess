/**
 * Đồng hồ đếm ngược của người giải: chỉ chạy trong lượt của người giải (giống đồng hồ cờ).
 * Bất biến: `runningSince` là thời điểm bắt đầu chạy (ms), null khi đang dừng.
 */
export interface Clock {
  remainingMs: number
  runningSince: number | null
}

export const newClock = (limitMs: number): Clock => ({ remainingMs: limitMs, runningSince: null })

export function remaining(clock: Clock, now: number): number {
  if (clock.runningSince === null) return clock.remainingMs
  return Math.max(0, clock.remainingMs - Math.max(0, now - clock.runningSince))
}

export function startClock(clock: Clock, now: number): Clock {
  return clock.runningSince === null ? { ...clock, runningSince: now } : clock
}

export function pauseClock(clock: Clock, now: number): Clock {
  return clock.runningSince === null ? clock : { remainingMs: remaining(clock, now), runningSince: null }
}

export const isTimeUp = (clock: Clock, now: number) => remaining(clock, now) <= 0

/** 65_400 → "1:06" (làm tròn lên); dưới 10 s hiện phần mười: 7_300 → "7.3". */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, ms) / 1000
  if (s < 10) return s.toFixed(1)
  const whole = Math.ceil(s)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
