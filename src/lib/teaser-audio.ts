import { T } from './teaser-timeline'

/* ===========================================================================
 *  The score, synthesised rather than shipped.
 *
 *  There's no audio file in the repo: everything below is built out of
 *  oscillators and filtered noise at runtime. That keeps the bundle at zero
 *  extra bytes and — more usefully — lets every hit be scheduled against the
 *  same timeline the picture uses, so the impact lands on the frame where the
 *  challenger hits the board rather than a few hundred ms either side of it.
 *
 *  If you'd rather have a real track, drop the file in public/viernes/ and set
 *  TRACK_URL to its name. The synth score is skipped when that's set.
 * ======================================================================== */

/** e.g. 'teaser.mp3' — a file you've put in public/viernes/. */
export const TRACK_URL: string | null = null

const ms = (v: number) => v / 1000

/** One shared noise buffer; rebuilding it per hit is pure waste. */
let noiseBuffer: AudioBuffer | null = null
function noise(ctx: AudioContext) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    const length = ctx.sampleRate * 2
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

/** A heartbeat thud: pitch collapses fast, which is what reads as "kick". */
function kick(ctx: AudioContext, out: AudioNode, at: number, gain: number) {
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.frequency.setValueAtTime(160, at)
  osc.frequency.exponentialRampToValueAtTime(42, at + 0.16)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(gain, at + 0.008)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.34)
  osc.connect(env).connect(out)
  osc.start(at)
  osc.stop(at + 0.4)
}

/** Filtered noise burst — the air around a hit. */
function crack(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  dur: number,
  gain: number,
  cutoff: number,
) {
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()
  src.buffer = noise(ctx)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(cutoff, at)
  filter.frequency.exponentialRampToValueAtTime(220, at + dur)
  env.gain.setValueAtTime(gain, at)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(filter).connect(env).connect(out)
  src.start(at)
  src.stop(at + dur + 0.05)
}

/** The tension sweep that carries the wobble into the cut. */
function riser(ctx: AudioContext, out: AudioNode, at: number, dur: number) {
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(70, at)
  osc.frequency.exponentialRampToValueAtTime(760, at + dur)
  filter.type = 'bandpass'
  filter.Q.value = 6
  filter.frequency.setValueAtTime(200, at)
  filter.frequency.exponentialRampToValueAtTime(2600, at + dur)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.16, at + dur * 0.92)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(filter).connect(env).connect(out)
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

/** Two detuned saws under everything, so the frame is never silent. */
function drone(ctx: AudioContext, out: AudioNode, at: number, dur: number) {
  const env = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 320
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.075, at + 0.9)
  env.gain.setValueAtTime(0.075, at + dur - 0.6)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  filter.connect(env).connect(out)

  for (const detune of [-7, 7]) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 55
    osc.detune.value = detune
    osc.connect(filter)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }
}

/** A short bright tick — the clock the leaderboard is counting against. */
function tick(ctx: AudioContext, out: AudioNode, at: number, gain: number) {
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()
  src.buffer = noise(ctx)
  filter.type = 'highpass'
  filter.frequency.value = 6500
  env.gain.setValueAtTime(gain, at)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.045)
  src.connect(filter).connect(env).connect(out)
  src.start(at)
  src.stop(at + 0.08)
}

/** A plucked bass note, so the opening has a pulse and not just a hum. */
function sub(ctx: AudioContext, out: AudioNode, at: number, hz: number, gain: number) {
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = hz
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(gain, at + 0.012)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.42)
  osc.connect(env).connect(out)
  osc.start(at)
  osc.stop(at + 0.5)
}

/** Air rushing in as the frame opens. */
function whoosh(ctx: AudioContext, out: AudioNode, at: number, dur: number) {
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()
  src.buffer = noise(ctx)
  filter.type = 'bandpass'
  filter.Q.value = 1.4
  filter.frequency.setValueAtTime(3200, at)
  filter.frequency.exponentialRampToValueAtTime(280, at + dur)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.22, at + dur * 0.3)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(filter).connect(env).connect(out)
  src.start(at)
  src.stop(at + dur + 0.05)
}

/**
 * A sustained low chord. Slow in, slow out, no attack to speak of — this is
 * what holds the title card up now that nothing is ticking under it.
 */
function chord(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  dur: number,
  notes: number[],
  gain: number,
) {
  const env = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(400, at)
  filter.frequency.exponentialRampToValueAtTime(1500, at + dur * 0.7)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(gain, at + dur * 0.35)
  env.gain.setValueAtTime(gain, at + dur * 0.7)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  filter.connect(env).connect(out)

  for (const hz of notes) {
    for (const detune of [-5, 6]) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = hz
      osc.detune.value = detune
      osc.connect(filter)
      osc.start(at)
      osc.stop(at + dur + 0.05)
    }
  }
}

/** A wide, slow rise. Tension without a pulse. */
function swell(ctx: AudioContext, out: AudioNode, at: number, dur: number) {
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()
  src.buffer = noise(ctx)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(180, at)
  filter.frequency.exponentialRampToValueAtTime(1900, at + dur)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.1, at + dur * 0.85)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(filter).connect(env).connect(out)
  src.start(at)
  src.stop(at + dur + 0.05)
}

/** The long drop under the title card. */
function boom(ctx: AudioContext, out: AudioNode, at: number, gain: number) {
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.frequency.setValueAtTime(90, at)
  osc.frequency.exponentialRampToValueAtTime(28, at + 1.1)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(gain, at + 0.02)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 1.5)
  osc.connect(env).connect(out)
  osc.start(at)
  osc.stop(at + 1.6)
}

/**
 * Schedules the whole ~10s cue. Returns a teardown that kills it mid-play,
 * which is what a replay tap needs so two scores don't stack on top of
 * each other.
 */
export function playScore(ctx: AudioContext) {
  const master = ctx.createGain()
  const glue = ctx.createDynamicsCompressor()
  master.gain.value = 0.55
  glue.threshold.value = -18
  glue.ratio.value = 6
  master.connect(glue).connect(ctx.destination)

  const t0 = ctx.currentTime + 0.03

  drone(ctx, master, t0, ms(T.cut))
  whoosh(ctx, master, t0, 0.7)

  // A pulse per row as the leaderboard builds.
  for (let i = 0; i < 5; i++) {
    kick(ctx, master, t0 + ms(T.rowsIn + i * T.rowStagger), 0.5)
  }

  // A steady tick from just after the frame opens all the way to the cut, so
  // the opening is never just a hum, and a bass pulse on every other tick to
  // give it a floor. It starts ahead of the first row on purpose — the clock
  // is already running when the leaderboard arrives.
  const TICK = 0.2
  let beat = 0
  for (let at = 0.2; at < ms(T.cut); at += TICK, beat++) {
    tick(ctx, master, t0 + at, beat % 4 === 0 ? 0.09 : 0.045)
    if (beat % 2 === 0) {
      // Walks down a semitone at a time — it gets more ominous as it goes.
      sub(ctx, master, t0 + at, 82.4 - beat * 1.1, 0.16)
    }
  }

  // Push-in: one softer hit, then the tension starts climbing.
  kick(ctx, master, t0 + ms(T.pushIn), 0.35)
  riser(ctx, master, t0 + ms(T.wobble), ms(T.cut - T.wobble))

  // The dethroning. This is the moment the whole cue is built around.
  kick(ctx, master, t0 + ms(T.mysteryIn), 0.95)
  crack(ctx, master, t0 + ms(T.mysteryIn), 0.55, 0.5, 5200)
  boom(ctx, master, t0 + ms(T.shove), 0.55)

  /* --- title card ---------------------------------------------------------
   * The clock stops here. Everything up to the cut is pulse — ticks, kicks, a
   * riser — so carrying that under the hook would make the hard cut sound like
   * nothing happened. Instead the rhythm drops out entirely and a low A-minor
   * chord opens up underneath, with one slow swell walking into the kicker.
   * ------------------------------------------------------------------------ */
  const cardAt = t0 + ms(T.hook)
  const cardFor = ms(T.end - T.hook)

  crack(ctx, master, cardAt, 1.1, 0.11, 900)
  chord(ctx, master, cardAt, cardFor, [55, 82.41, 110], 0.13)
  sub(ctx, master, cardAt, 41.2, 0.5)
  swell(ctx, master, cardAt + 0.3, ms(T.kicker - T.hook) - 0.3)

  boom(ctx, master, t0 + ms(T.kicker), 0.6)
  kick(ctx, master, t0 + ms(T.kicker), 0.7)

  // The chord is still ringing under the hold; this is just its floor.
  sub(ctx, master, t0 + ms(T.kicker) + 1.2, 41.2, 0.2)

  return () => {
    // Ramp instead of a hard disconnect; cutting a running oscillator dead
    // produces an audible click.
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
    setTimeout(() => master.disconnect(), 200)
  }
}
