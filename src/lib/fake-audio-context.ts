/**
 * A stand-in for the Web Audio API, for tests only.
 *
 * jsdom has no AudioContext, and the real one can't be driven headlessly
 * anyway. `create()` mints a fresh context per call the way `new
 * AudioContext()` does, while every context records into one shared list of
 * scheduled start times so a test can assert what the score booked and when.
 * Nodes throw on a closed context exactly like the real thing — that's the
 * failure worth catching.
 *
 * It also models user activation: like Chrome, `resume()` leaves the context
 * suspended until the document has seen a gesture. Without that a test can't
 * tell "plays once unlocked" apart from "plays whenever it likes".
 */
export interface FakeAudio {
  /** Mint a context, as `new AudioContext()` would. */
  create: () => AudioContext
  /** Start times of every source scheduled, across every context, in seconds. */
  starts: number[]
  /**
   * Every source as a [start, stop] span. Start times alone can't tell a
   * silent stretch from a sustained one, which matters once the score leans
   * on pads instead of hits.
   */
  spans: Array<[number, number]>
  resumes: number
  /** The most recently created context. */
  latest: AudioContext | null
}

const param = () => ({
  value: 0,
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
  cancelScheduledValues() {},
})

export function fakeAudioContext(): FakeAudio {
  const starts: number[] = []
  const spans: Array<[number, number]> = []
  let resumes = 0
  let latest: AudioContext | null = null

  // Stands in for the browser's user-activation bit.
  let activated = false
  if (typeof document !== 'undefined') {
    const activate = () => {
      activated = true
    }
    document.addEventListener('pointerdown', activate, true)
    document.addEventListener('keydown', activate, true)
  }

  const create = () => {
    let state: AudioContextState = 'suspended'

    const node = () => {
      if (state === 'closed') {
        throw new DOMException('context is closed', 'InvalidStateError')
      }
      let startedAt = 0
      return {
        connect: (target: unknown) => target,
        disconnect() {},
        gain: param(),
        frequency: param(),
        detune: param(),
        Q: param(),
        threshold: param(),
        ratio: param(),
        type: '',
        buffer: null as unknown,
        start: (at: number) => {
          startedAt = at
          starts.push(at)
        },
        stop: (at: number) => spans.push([startedAt, at]),
      }
    }

    const ctx = {
      get state() {
        return state
      },
      currentTime: 0,
      sampleRate: 48000,
      get destination() {
        return node()
      },
      createOscillator: node,
      createGain: node,
      createBufferSource: node,
      createBiquadFilter: node,
      createDynamicsCompressor: node,
      createBuffer: (_channels: number, length: number) => ({
        sampleRate: 48000,
        getChannelData: () => new Float32Array(length),
      }),
      resume() {
        resumes++
        if (state === 'closed') {
          return Promise.reject(new DOMException('closed', 'InvalidStateError'))
        }
        // Chrome resolves but stays suspended when there's been no gesture.
        if (activated) state = 'running'
        return Promise.resolve()
      },
      close() {
        state = 'closed'
        return Promise.resolve()
      },
    } as unknown as AudioContext

    latest = ctx
    return ctx
  }

  return {
    create,
    starts,
    spans,
    get resumes() {
      return resumes
    },
    get latest() {
      return latest
    },
  }
}
