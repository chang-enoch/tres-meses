import { useCallback, useEffect, useRef, useState } from 'react'
import { VIERNES } from '../content/viernes'
import { BLACKOUT, T } from '../lib/teaser-timeline'
import { TRACK_URL, playScore } from '../lib/teaser-audio'
import '../styles/beli-teaser.css'

/* ===========================================================================
 *  A ~10 second clip, rendered instead of encoded.
 *
 *  Everything is driven off a single requestAnimationFrame clock: `t` is the
 *  number of milliseconds since the clip started, and every transform on
 *  screen is a pure function of it. That's deliberate — a pile of setTimeouts
 *  drifts apart on a busy phone and can't be replayed cleanly, whereas one
 *  clock means "start over" is just `t = 0`.
 *
 *  Only opacity and transform are animated. Nothing here touches a layout
 *  property, so the whole thing stays on the compositor.
 * ======================================================================== */

/** Fixed row pitch in px. The shove animation moves rows by exactly this. */
const ROW_H = 52

/* ------------------------------------------------------------------ easing */

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Progress through a segment of the timeline, 0 before it, 1 after. */
const seg = (t: number, start: number, dur: number) => clamp01((t - start) / dur)

const outCubic = (p: number) => 1 - Math.pow(1 - p, 3)
const outQuint = (p: number) => 1 - Math.pow(1 - p, 5)

/** Overshoots past 1 and settles — the spring the shove and the kicker use. */
const outBack = (p: number) => {
  const c = 1.7
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2)
}

/* ------------------------------------------------------------------- board */

/**
 * A fake leaderboard. The names are redaction bars, not text — partly for the
 * bit, mostly so no real restaurant (hers or Friday's) is ever in the DOM.
 * `bars` are the widths of the blocks that stand in for a name.
 */
const ROWS = [
  { score: '9.8', bars: [58, 34] },
  { score: '9.5', bars: [42, 50] },
  { score: '9.1', bars: [66] },
  { score: '8.7', bars: [38, 44] },
  { score: '8.4', bars: [50, 30] },
]

const HOOK_WORDS = VIERNES.teaser.hook.split(' ')

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function BeliTeaser() {
  // Reduced motion opens on the last frame: the joke still lands, nothing moves.
  const reduced = prefersReducedMotion()
  const [t, setT] = useState(() => (reduced ? T.end : 0))
  const [playing, setPlaying] = useState(false)
  /** Bumped on every replay so the play effect re-runs from the top. */
  const [run, setRun] = useState(0)
  /**
   * Whether sound is actually coming out. Not a preference — sound is always
   * wanted — but a fact about the browser: audio can't start until the page
   * has seen a gesture, so until then this is false and the frame says so.
   */
  const [audible, setAudible] = useState(false)
  /** On screen. Not the same as "playing" — the clip also waits for audio. */
  const [seen, setSeen] = useState(false)
  /** Whether the clip has been allowed to run at all yet. */
  const [started, setStarted] = useState(false)

  const frame = useRef(0)
  const box = useRef<HTMLDivElement>(null)
  const audio = useRef<AudioContext | null>(null)
  const track = useRef<HTMLAudioElement | null>(null)

  /** Lazily builds the context. It starts suspended until a gesture unlocks it. */
  const context = useCallback(() => {
    if (!audio.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (Ctor) audio.current = new Ctor()
    }
    return audio.current
  }, [])

  /**
   * Note when the clip scrolls into view.
   *
   * It sits below the countdown, so on a phone it's off screen at load —
   * running it there would mean she scrolls down to a finished clip and never
   * sees the joke land.
   */
  useEffect(() => {
    if (reduced) return
    const el = box.current
    if (!el || typeof IntersectionObserver !== 'function') {
      setSeen(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        setSeen(true)
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [reduced])

  /**
   * Sound is on by default, but no browser will make noise before the page has
   * been interacted with. So try immediately — some browsers already allow it,
   * and on a phone the touch that scrolls the clip into view is itself the
   * permission — and keep trying on every gesture until one takes.
   *
   * Not `{ once: true }`: the first attempt can fail, and a listener that
   * removed itself on a failed attempt would never unlock at all.
   */
  useEffect(() => {
    if (reduced || TRACK_URL || audible) return
    const ctx = context()
    if (!ctx) return

    const tryUnlock = () => {
      if (ctx.state === 'running') {
        setAudible(true)
        return
      }
      void ctx
        .resume()
        .then(() => setAudible(ctx.state === 'running'))
        .catch(() => {})
    }

    tryUnlock()
    const gestures = ['pointerdown', 'touchstart', 'keydown', 'click'] as const
    for (const type of gestures) {
      document.addEventListener(type, tryUnlock, { passive: true })
    }
    return () => {
      for (const type of gestures) document.removeEventListener(type, tryUnlock)
    }
  }, [reduced, context, audible])

  /**
   * Run the clip once it's both on screen and able to make noise.
   *
   * Deliberately not "on screen" alone. Playing it muted the moment it
   * appears spends the one first impression on a silent version, and she only
   * gets the scored one if she happens to tap replay. Waiting means the first
   * time she sees it, she hears it.
   */
  useEffect(() => {
    if (reduced || started || !seen) return
    if (!audible && !TRACK_URL) return
    setStarted(true)
    setT(0)
    setRun((n) => n + 1)
    setPlaying(true)
  }, [reduced, started, seen, audible])

  useEffect(() => {
    if (!playing) return

    let stopScore: (() => void) | undefined
    let dropped = false

    /**
     * Resume first, then score. The context is usually still suspended at the
     * instant this effect runs — a tap calls resume(), but resume resolves a
     * microtask later — so checking the state up front would skip the score
     * on the very play the tap was asking for.
     */
    const startSound = async () => {
      if (TRACK_URL) {
        const el = track.current
        if (el) {
          el.currentTime = 0
          void el.play().catch(() => {})
        }
        return
      }
      const ctx = context()
      if (!ctx) return
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume()
        } catch {
          return // No gesture yet. The clip plays silently; that's fine.
        }
      }
      if (dropped || ctx.state !== 'running') return
      setAudible(true)
      stopScore = playScore(ctx)
    }
    void startSound()

    /**
     * Picture and sound run off different clocks: rAF stops dead when the tab
     * is backgrounded, but the AudioContext keeps counting. Coming back to a
     * score playing over a frozen frame is worse than no score, so leaving the
     * page ends the clip on its last frame.
     */
    const onHide = () => {
      if (!document.hidden) return
      dropped = true
      cancelAnimationFrame(frame.current)
      stopScore?.()
      track.current?.pause()
      setT(T.end)
      setPlaying(false)
    }
    document.addEventListener('visibilitychange', onHide)

    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const elapsed = now - start
      setT(Math.min(elapsed, T.end))
      if (elapsed < T.end) frame.current = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    frame.current = requestAnimationFrame(tick)

    return () => {
      dropped = true
      document.removeEventListener('visibilitychange', onHide)
      cancelAnimationFrame(frame.current)
      stopScore?.()
      track.current?.pause()
    }
  }, [playing, run, context])

  const replay = useCallback(() => {
    // Safari hands back a suspended context even inside a gesture handler, so
    // resume every time rather than only on the first tap.
    const ctx = context()
    if (ctx && ctx.state !== 'running') {
      void ctx
        .resume()
        .then(() => setAudible(ctx.state === 'running'))
        .catch(() => {})
    }
    setStarted(true)
    setT(0)
    setRun((n) => n + 1)
    setPlaying(true)
  }, [context])

  useEffect(() => {
    return () => {
      // Drop the reference as well as closing it. React mounts, unmounts and
      // remounts this component in development, and a closed AudioContext can
      // never be resumed or build a node again — holding on to one here meant
      // every later play was silently a no-op.
      const ctx = audio.current
      audio.current = null
      void ctx?.close().catch(() => {})
    }
  }, [])

  /* ---------------------------------------------------------- derived state */

  const inTitles = t >= T.cut
  const black = t >= T.cut && t < T.cut + BLACKOUT

  // The push-in. The whole list scales, so it reads as a camera move rather
  // than one row growing.
  const push = outQuint(seg(t, T.pushIn, 700))
  const listScale = 1 + push * 0.06

  // Wobble decays into the shove instead of stopping dead.
  const wobbleOn = seg(t, T.wobble, 200) * (1 - seg(t, T.mysteryIn, 400))
  const wobble = Math.sin(t * 0.045) * 3.5 * wobbleOn

  const mystery = outBack(seg(t, T.mysteryIn, 800))
  const shove = outBack(seg(t, T.shove, 600))

  // The frame flares white-hot on the hit, then falls back.
  const flash = Math.max(
    seg(t, T.mysteryIn, 60) * (1 - seg(t, T.mysteryIn + 60, 380)),
    seg(t, T.kicker, 60) * (1 - seg(t, T.kicker + 60, 420)),
  )

  const progress = t / T.end

  return (
    <div
      ref={box}
      className="teaser"
      onClick={replay}
      role="button"
      tabIndex={0}
      aria-label="Replay the teaser"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') replay()
      }}
    >
      <div className="teaser__bar" style={{ transform: `scaleX(${progress})` }} />

      <div className="teaser__stage" style={{ opacity: black ? 0 : 1 }}>
        {!inTitles && (
          <div
            className="teaser__list"
            style={{
              transform: `scale(${listScale})`,
              opacity: outCubic(seg(t, T.headerIn, 400)),
            }}
          >
            <div className="teaser__header">{VIERNES.teaser.header}</div>

            <div className="teaser__rows" style={{ height: (ROWS.length + 1) * ROW_H }}>
              {ROWS.map((row, i) => {
                const appear = outCubic(seg(t, T.rowsIn + i * T.rowStagger, 420))
                const isTop = i === 0
                // Everything but the throne dims once the camera pushes in.
                const dim = isTop ? 1 : 1 - push * 0.62
                const y = i * ROW_H + shove * ROW_H
                const x = isTop ? wobble : 0
                // The champion's score glitches while it senses the threat.
                const scoreFlicker =
                  isTop && wobbleOn > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 0.02)) : 1

                return (
                  <div
                    key={i}
                    className={`teaser__row ${isTop && wobbleOn > 0 ? 'teaser__row--doomed' : ''}`}
                    style={{
                      transform: `translate3d(${x}px, ${y + (1 - appear) * 24}px, 0)`,
                      opacity: appear * dim,
                    }}
                  >
                    <span className="teaser__rank">{i + 1 + (shove > 0.5 ? 1 : 0)}</span>
                    <span className="teaser__name">
                      {row.bars.map((w, b) => (
                        <span key={b} className="teaser__redact" style={{ width: w }} />
                      ))}
                    </span>
                    <span className="teaser__score" style={{ opacity: scoreFlicker }}>
                      {row.score}
                    </span>
                  </div>
                )
              })}

              {/* The challenger. Comes up hard from below the frame edge. */}
              <div
                className="teaser__row teaser__row--new"
                style={{
                  transform: `translate3d(0, ${(1 - mystery) * (ROWS.length * ROW_H + 90)}px, 0)`,
                  opacity: mystery > 0 ? 1 : 0,
                }}
              >
                <span className="teaser__rank teaser__rank--new">1</span>
                <span className="teaser__name teaser__name--new">?</span>
                <span className="teaser__arrow">▲</span>
                <span className="teaser__score teaser__score--new">10.0</span>
              </div>
            </div>
          </div>
        )}

        {inTitles && (
          <div className="teaser__titles">
            <p className="teaser__hook">
              {HOOK_WORDS.map((word, i) => {
                const p = outCubic(seg(t, T.hook + i * T.wordStagger, 500))
                return (
                  <span
                    key={i}
                    style={{
                      opacity: p,
                      transform: `translate3d(0, ${(1 - p) * 10}px, 0)`,
                    }}
                  >
                    {word}
                  </span>
                )
              })}
            </p>
            <p
              className="teaser__kicker"
              style={{
                opacity: outCubic(seg(t, T.kicker, 400)),
                transform: `scale(${0.94 + outBack(seg(t, T.kicker, 600)) * 0.06})`,
              }}
            >
              {VIERNES.teaser.kicker}
            </p>
          </div>
        )}
      </div>

      {!reduced && !started && (
        <div className="teaser__play">
          <span className="teaser__play-icon" aria-hidden="true">
            ▶
          </span>
          <span className="teaser__play-text">{VIERNES.teaser.playHint}</span>
        </div>
      )}

      <div className="teaser__flash" style={{ opacity: flash * 0.5 }} aria-hidden="true" />
      <div className="teaser__vignette" aria-hidden="true" />
      <div className="teaser__grain" aria-hidden="true" />

      {/* Redundant while the play overlay is up — that already says "tap". */}
      {started && (
        <span className="teaser__sound" aria-hidden="true">
          {audible ? VIERNES.teaser.soundOn : VIERNES.teaser.soundHint}
        </span>
      )}

      <span
        className="teaser__replay"
        style={{ opacity: outCubic(seg(t, T.replay, 500)) }}
        aria-hidden="true"
      >
        ↻ {VIERNES.teaser.replay}
      </span>

      {TRACK_URL && (
        <audio
          ref={track}
          src={`${import.meta.env.BASE_URL}viernes/${TRACK_URL}`}
          preload="auto"
        />
      )}
    </div>
  )
}
