import { planSegments } from '../../fork/stories/segmentation'

const pause = (startS: number, endS: number) => ({
  startMs: startS * 1000,
  endMs: endS * 1000,
})

// Segments must cover the whole recording, in order, with no gaps
const expectContiguous = (
  segments: { start_ms: number; end_ms: number }[],
  durationMs: number
) => {
  expect(segments[0].start_ms).toBe(0)
  expect(segments[segments.length - 1].end_ms).toBe(durationMs)
  segments.slice(1).forEach((segment, i) => {
    expect(segment.start_ms).toBe(segments[i].end_ms)
    expect(segment.end_ms).toBeGreaterThan(segment.start_ms)
  })
}

describe('planSegments', () => {
  it('returns one segment for a short recording without pauses', () => {
    expect(planSegments(8000, [])).toEqual([{ start_ms: 0, end_ms: 8000 }])
  })

  it('returns nothing for an empty recording', () => {
    expect(planSegments(0, [])).toEqual([])
  })

  it('cuts in the middle of pauses', () => {
    const segments = planSegments(16000, [pause(4, 5), pause(10, 11)])
    expect(segments).toEqual([
      { start_ms: 0, end_ms: 4500 },
      { start_ms: 4500, end_ms: 10500 },
      { start_ms: 10500, end_ms: 16000 },
    ])
  })

  it('ignores pauses at the very start and end', () => {
    const segments = planSegments(10000, [pause(0, 1.5), pause(9, 10)])
    expect(segments).toEqual([{ start_ms: 0, end_ms: 10000 }])
  })

  it('does not make segments shorter than the minimum', () => {
    // Pauses 1 s apart: only every third or so can be a cut
    const pauses = Array.from({ length: 19 }, (_, i) => pause(i + 1, i + 1.5))
    const segments = planSegments(20000, pauses)
    expectContiguous(segments, 20000)
    for (const segment of segments) {
      expect(segment.end_ms - segment.start_ms).toBeGreaterThanOrEqual(3000)
    }
  })

  it('cuts at the longest pause when speech runs past the usual length', () => {
    // No pause between 3 s and 20 s; two later ones, the second longer
    const segments = planSegments(60000, [pause(22, 22.6), pause(26, 28)])
    expect(segments[0]).toEqual({ start_ms: 0, end_ms: 27000 })
    expectContiguous(segments, 60000)
  })

  it('cuts anyway when there is no pause at all', () => {
    const segments = planSegments(95000, [])
    expectContiguous(segments, 95000)
    for (const segment of segments) {
      expect(segment.end_ms - segment.start_ms).toBeLessThanOrEqual(30000)
      expect(segment.end_ms - segment.start_ms).toBeGreaterThanOrEqual(3000)
    }
  })

  it('never leaves a very short last segment', () => {
    // A forced cut at 30 s would leave 0.5 s
    const segments = planSegments(30500, [])
    expectContiguous(segments, 30500)
    expect(
      segments[segments.length - 1].end_ms -
        segments[segments.length - 1].start_ms
    ).toBeGreaterThanOrEqual(3000)
  })

  it('handles an hour-long recording with regular pauses', () => {
    const duration = 3600 * 1000
    const pauses = Array.from({ length: 700 }, (_, i) =>
      pause(i * 5 + 4, i * 5 + 4.7)
    )
    const segments = planSegments(duration, pauses)
    expectContiguous(segments, duration)
    expect(segments.length).toBeGreaterThan(500)
  })
})
