/**
 * The teaser's timeline, in milliseconds from the start of the clip.
 *
 * It lives in its own module because two things read it: the component that
 * draws the frames and the module that scores them. If those two ever kept
 * separate copies, the impact would drift off the hit and the whole thing
 * would stop feeling like one piece of footage.
 */
export const T = {
  headerIn: 0,
  rowsIn: 600,
  rowStagger: 110,
  pushIn: 2200,
  wobble: 2900,
  mysteryIn: 3800,
  shove: 4000,
  cut: 5000,
  hook: 5200,
  wordStagger: 140,
  kicker: 7200,
  replay: 8600,
  end: 9800,
} as const

/** How long the frame stays on hard black after the cut. */
export const BLACKOUT = 120
