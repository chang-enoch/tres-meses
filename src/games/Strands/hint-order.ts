import type { Placement } from '../../content/strands-grid.gen'

/**
 * Which word the next hint should light up.
 *
 * Ordering, in priority order:
 *
 *   1. The spangram always comes last, however short it is. It's the shape of
 *      the whole puzzle — handing it over early gives away more than any
 *      ordinary word, and it's the one she'd most want to get herself.
 *   2. Then shortest first. A hint she can actually cash in beats a
 *      technically-correct one pointing at the hardest word on the board.
 *   3. Then alphabetical, so repeat hints are deterministic rather than
 *      depending on the order the packer happened to place words in.
 */
export function pickHintWord(
  placements: readonly Placement[],
  found: readonly string[],
  hinted: readonly string[],
): Placement | undefined {
  return placements
    .filter((p) => !found.includes(p.word) && !hinted.includes(p.word))
    .sort(
      (a, b) =>
        Number(a.spangram) - Number(b.spangram) ||
        a.word.length - b.word.length ||
        a.word.localeCompare(b.word),
    )[0]
}
