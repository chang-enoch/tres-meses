import { describe, expect, it } from 'vitest'
import { fakeAudioContext } from './fake-audio-context'
import { playScore } from './teaser-audio'
import { T } from './teaser-timeline'

/**
 * The score is scheduled, not played, in here — every node is booked against
 * the AudioContext clock the moment playScore is called. That makes it
 * testable without a speaker: stub the context, collect the start times, and
 * assert the cue actually covers the clip.
 */

describe('teaser score', () => {
  const audio = fakeAudioContext()
  const starts = audio.starts
  playScore(audio.create())
  const t0 = Math.min(...starts)

  /** Merged [start, end] spans of anything making noise, relative to t0. */
  const covered = audio.spans
    .map(([a, b]) => [a - t0, b - t0] as [number, number])
    .sort((x, y) => x[0] - y[0])
    .reduce<Array<[number, number]>>((merged, span) => {
      const last = merged[merged.length - 1]
      if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1])
      else merged.push([...span])
      return merged
    }, [])
  const times = starts.map((t) => t - t0).sort((a, b) => a - b)

  it('schedules the whole cue', () => {
    expect(times.length).toBeGreaterThan(30)
  })

  it('never leaves the clip actually silent', () => {
    // Measured on sustained spans, not hit times: the title card deliberately
    // has no pulse under it, and a chord holding for four seconds is not a
    // silence. Anything that isn't covered by *something* is.
    let worst = 0
    let cursor = 0
    for (const [from, to] of covered) {
      worst = Math.max(worst, from - cursor)
      cursor = Math.max(cursor, to)
    }
    expect(worst).toBeLessThan(0.25)
    expect(cursor).toBeGreaterThan(T.end / 1000 - 0.5)
  })

  it('drops the pulse for the title card', () => {
    // The cut has to land as a change. If the back half is as busy with
    // discrete hits as the front half, it doesn't.
    const front = times.filter((t) => t < T.cut / 1000).length
    const back = times.filter((t) => t >= T.cut / 1000).length
    expect(back).toBeLessThan(front / 3)
  })

  it('scores the opening, not just the payoff', () => {
    // Everything before the camera pushes in — the stretch that was bare.
    const opening = times.filter((t) => t < T.pushIn / 1000)
    expect(opening.length).toBeGreaterThan(10)
  })

  it('lands a hit on the frame where the challenger arrives', () => {
    const impact = T.mysteryIn / 1000
    expect(times.some((t) => Math.abs(t - impact) < 0.02)).toBe(true)
  })

  it('runs to the end of the clip', () => {
    expect(times[times.length - 1]).toBeGreaterThan(T.kicker / 1000)
  })
})
