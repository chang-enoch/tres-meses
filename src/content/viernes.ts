/* ===========================================================================
 *  ALL COPY FOR THE FRIDAY TEASER LIVES HERE.
 *
 *  Rule that outranks everything else in this file: the restaurant is never
 *  named. Not in copy, not in an aria-label, not in a comment that could end
 *  up in the shipped bundle. She gets logistics and a vibe, nothing more.
 * ======================================================================== */

/**
 * Absolute instants, not local-time strings.
 *
 * `new Date('2026-09-04 18:30')` would be parsed in whatever timezone the
 * phone happens to be set to. The +08:00 offset pins both of these to Hong
 * Kong so the countdown stays honest even if she's looking at it on a plane.
 */
export const DINNER_AT = Date.parse("2026-09-04T18:30:00+08:00");
export const PICKUP_AT = Date.parse("2026-09-04T17:45:00+08:00");

export interface LogisticsRow {
  /** Big text on the left. Kept short — this is a 2-column grid on an SE. */
  value: string;
  /** The quiet line underneath. */
  note: string;
}

export const VIERNES = {
  title: "viernes",
  subtitle: "una mesa para dos. tu ranking está en peligro.",
  dateline: "friday · september 4",

  countdownLabel: "until impact",
  /** Shown once DINNER_AT has passed, instead of counting into the negatives. */
  afterLabel: "too late. it's happening.",

  logistics: [
    { value: "5:45", note: "BE READY, I'M COMING TO GET YOU." },
    { value: "6:30", note: "THE TABLE, LET'S NOT BE LATE." },
    {
      value: "dress up",
      note: "WEAR SOMETHING NICE THAT WILL KEEP MY JAW DROPPED FOR THE NIGHT.",
    },
  ] satisfies LogisticsRow[],

  /** The teaser clip. Each word fades up on its own beat, so keep it terse. */
  teaser: {
    header: "your top rated",
    hook: "your beli top spot looks vulnerable",
    kicker: "friday. 6:30. come hungry.",
    replay: "again",
    /** Shown over the frame until a gesture lets the browser play audio. */
    playHint: "tap to play",
    soundHint: "tap for sound",
    soundOn: "sound on",
  },

  hubLink: "travel back in time",
} as const;
