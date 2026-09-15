import { describe, expect, it } from 'vitest'
import { formatClock, formatMinutes, inferMinutes, resolveMinutes } from './timer'

describe('inferMinutes', () => {
  it('reads minutes, ranges and hours from titles', () => {
    expect(inferMinutes('Easy walk 15-20 min')).toBe(15)
    expect(inferMinutes('Mobility routine 5-10 min')).toBe(5)
    expect(inferMinutes('Walk 25-30 min')).toBe(25)
    expect(inferMinutes('45m circuit')).toBe(45)
    expect(inferMinutes('Deep work 1 hour')).toBe(60)
    expect(inferMinutes('2h study block')).toBe(120)
    expect(inferMinutes('Five-minute minimum (walk around the block)')).toBe(5)
    expect(inferMinutes('Ten minute tidy')).toBe(10)
  })
  it('ignores numbers that are not durations', () => {
    expect(inferMinutes('Sutton and Barto Ch. 1-3')).toBeNull()
    expect(inferMinutes('Taxi-v3 in 3 files')).toBeNull()
  })
})

describe('resolveMinutes', () => {
  it('prefers the explicit token, then the title, then the default', () => {
    expect(resolveMinutes({ title: 'Walk 15 min', duration_min: 40 })).toBe(40)
    expect(resolveMinutes({ title: 'Walk 15 min', duration_min: null })).toBe(15)
    expect(resolveMinutes({ title: 'Read', duration_min: null })).toBe(25)
  })
})

describe('formatting', () => {
  it('formats clocks', () => {
    expect(formatClock(15 * 60_000)).toBe('15:00')
    expect(formatClock(59_400)).toBe('1:00') // 59.4s rounds up
    expect(formatClock(3_723_000)).toBe('1:02:03')
    expect(formatClock(-5)).toBe('0:00')
  })
  it('formats minute labels', () => {
    expect(formatMinutes(15)).toBe('15m')
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(90)).toBe('1h 30m')
  })
})
