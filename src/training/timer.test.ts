import { describe, expect, it } from 'vitest'
import { formatCountdown, isTimeUp, newClock, pauseClock, remaining, startClock } from './timer'

describe('timer', () => {
  it('chỉ trừ giờ khi đang chạy', () => {
    let clock = newClock(30_000)
    expect(remaining(clock, 5_000)).toBe(30_000)
    clock = startClock(clock, 1_000)
    expect(remaining(clock, 4_000)).toBe(27_000)
    clock = pauseClock(clock, 4_000)
    expect(remaining(clock, 100_000)).toBe(27_000)
    clock = startClock(clock, 100_000)
    expect(remaining(clock, 102_000)).toBe(25_000)
  })

  it('startClock / pauseClock lặp lại không đổi gì', () => {
    const running = startClock(newClock(10_000), 0)
    expect(startClock(running, 5_000)).toBe(running)
    const paused = pauseClock(running, 1_000)
    expect(pauseClock(paused, 9_000)).toBe(paused)
  })

  it('now cũ hơn lúc bắt đầu chạy thì không cộng thêm giờ', () => {
    expect(remaining(startClock(newClock(30_000), 10_000), 2_000)).toBe(30_000)
  })

  it('hết giờ, không âm', () => {
    const clock = startClock(newClock(1_000), 0)
    expect(isTimeUp(clock, 999)).toBe(false)
    expect(isTimeUp(clock, 1_000)).toBe(true)
    expect(remaining(clock, 5_000)).toBe(0)
  })

  it('formatCountdown', () => {
    expect(formatCountdown(65_400)).toBe('1:06')
    expect(formatCountdown(60_000)).toBe('1:00')
    expect(formatCountdown(10_000)).toBe('0:10')
    expect(formatCountdown(7_300)).toBe('7.3')
    expect(formatCountdown(-5)).toBe('0.0')
  })
})
