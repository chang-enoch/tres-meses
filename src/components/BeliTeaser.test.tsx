import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import BeliTeaser from './BeliTeaser'
import { fakeAudioContext } from '../lib/fake-audio-context'

/**
 * The clip's audio has exactly one job that's easy to get wrong: it must
 * actually start. Browsers refuse to play sound before a gesture, so the
 * wiring is asynchronous and gesture-driven, and every version of "it's
 * silent" looks identical from the outside. These drive the real component
 * against a stub context and assert the score gets scheduled.
 *
 * Rendered under StrictMode on purpose — that's how the app mounts, and its
 * mount/unmount/remount is what a naive "close the context on unmount" gets
 * wrong.
 */

function stubEnvironment() {
  const audio = fakeAudioContext()
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        return audio.create()
      }
    },
  )
  // The clip waits to be scrolled into view; report it visible immediately.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private cb: IntersectionObserverCallback) {}
      observe() {
        this.cb(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        )
      }
      disconnect() {}
      unobserve() {}
    },
  )
  return audio
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('teaser audio', () => {
  it('stays silent until the page has been touched', async () => {
    const audio = stubEnvironment()
    render(
      <StrictMode>
        <BeliTeaser />
      </StrictMode>,
    )
    await act(async () => {})
    expect(audio.starts).toHaveLength(0)
  })

  it('waits rather than spending the first watch on a silent play', async () => {
    const audio = stubEnvironment()
    const { container } = render(
      <StrictMode>
        <BeliTeaser />
      </StrictMode>,
    )
    await act(async () => {})

    // On screen, but audio is still locked: the clip must not have run.
    expect(container.querySelector('.teaser__play')).not.toBeNull()
    expect(container.querySelector('.teaser__bar')).toHaveProperty('style.transform', 'scaleX(0)')

    await act(async () => {
      fireEvent.pointerDown(document.body)
    })

    // That gesture unlocks audio, so the first play she sees is the scored one.
    await waitFor(() => expect(audio.starts.length).toBeGreaterThan(30))
    expect(container.querySelector('.teaser__play')).toBeNull()
  })

  it('plays the score once any gesture unlocks audio', async () => {
    const audio = stubEnvironment()
    render(
      <StrictMode>
        <BeliTeaser />
      </StrictMode>,
    )
    await act(async () => {})

    await act(async () => {
      fireEvent.pointerDown(document.body)
    })

    await waitFor(() => expect(audio.starts.length).toBeGreaterThan(30))
  })

  it('plays the score again on a replay tap', async () => {
    const audio = stubEnvironment()
    const { container } = render(
      <StrictMode>
        <BeliTeaser />
      </StrictMode>,
    )
    await act(async () => {
      fireEvent.pointerDown(document.body)
    })
    await waitFor(() => expect(audio.starts.length).toBeGreaterThan(30))

    const first = audio.starts.length
    await act(async () => {
      fireEvent.click(container.querySelector('.teaser')!)
    })
    await waitFor(() => expect(audio.starts.length).toBeGreaterThan(first))
  })
})
