/**
 * Packs the Strands theme words into a board and generates
 * src/content/strands-grid.gen.ts.
 *
 *   node --experimental-strip-types scripts/build-strands.mjs [seed]
 *
 * Strands' defining constraint is that the spangram plus every theme word fill
 * the board exactly — no filler letters, no leftover cells. That makes this a
 * packing problem, and it's why generation happens here at authoring time
 * rather than in the browser: the app only ever renders a finished board.
 *
 * Approach is randomised backtracking with restarts:
 *   1. Place the spangram first. It's the most constrained piece, since it has
 *      to touch two opposite edges, and placing it last would almost always
 *      fail.
 *   2. Place remaining words longest-first — long words have the fewest legal
 *      paths, so failing on them early is cheap.
 *   3. After every placement, verify the free cells could still be filled.
 *      Without this the search wastes most of its time exploring boards that
 *      were already dead several words ago.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { STRANDS } from '../src/content/puzzles.ts'

const require = createRequire(import.meta.url)
const OUT = fileURLToPath(new URL('../src/content/strands-grid.gen.ts', import.meta.url))

const RESTARTS = 4000
const NODE_BUDGET = 30000 // DFS steps per word before giving up on this restart

/* ----------------------------------------------------------------- helpers */

/** Seeded PRNG so a given seed always reproduces the same board. */
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled(items, rng) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 8-directional adjacency, precomputed per cell. */
function buildNeighbours(W, H) {
  const all = []
  for (let i = 0; i < W * H; i++) {
    const r = (i / W) | 0
    const c = i % W
    const list = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = r + dr
        const nc = c + dc
        if (nr >= 0 && nr < H && nc >= 0 && nc < W) list.push(nr * W + nc)
      }
    }
    all.push(list)
  }
  return all
}

/**
 * Which 2x2 block a diagonal step cuts across, or -1 if the step is straight.
 *
 * Two words visually cross only one way: one takes a diagonal of some 2x2
 * block and another takes that block's opposite diagonal, meeting in an X at
 * the centre. A block has exactly two diagonals, so allowing at most one
 * diagonal step per block rules out every crossing on the board — including a
 * word crossing itself.
 */
function diagonalBlock(a, b, W) {
  const ra = (a / W) | 0
  const ca = a % W
  const rb = (b / W) | 0
  const cb = b % W
  if (ra === rb || ca === cb) return -1
  return Math.min(ra, rb) * (W - 1) + Math.min(ca, cb)
}

/** Every total reachable by some subset of the remaining word lengths. */
function subsetSums(lengths) {
  let sums = new Set([0])
  for (const len of lengths) {
    const next = new Set(sums)
    for (const s of sums) next.add(s + len)
    sums = next
  }
  return sums
}

/**
 * Could the free cells still be filled by exactly the remaining words?
 *
 * Each connected blob of free cells has to be consumed by some whole subset of
 * the remaining words, so any blob whose size isn't a reachable subset total is
 * proof the board is already dead. Cheap to check, and it prunes the great
 * majority of doomed branches.
 */
function stillFillable(free, nbrs, remainingLengths) {
  const sums = subsetSums(remainingLengths)
  const seen = new Uint8Array(free.length)

  for (let start = 0; start < free.length; start++) {
    if (!free[start] || seen[start]) continue
    let size = 0
    const stack = [start]
    seen[start] = 1
    while (stack.length) {
      const cell = stack.pop()
      size++
      for (const n of nbrs[cell]) {
        if (free[n] && !seen[n]) {
          seen[n] = 1
          stack.push(n)
        }
      }
    }
    if (!sums.has(size)) return false
  }
  return true
}

/* -------------------------------------------------------------- pathfinding */

/** Randomised self-avoiding DFS for a path of exactly `length` free cells. */
function findPath(free, nbrs, length, rng, budget, diag, W) {
  const starts = shuffled(
    [...free.keys()].filter((i) => free[i]),
    rng,
  )

  for (const start of starts) {
    const path = [start]
    free[start] = 0
    if (extend(path, free, nbrs, length, rng, budget, diag, W)) return path
    free[start] = 1
    if (budget.left <= 0) return null
  }
  return null
}

function extend(path, free, nbrs, length, rng, budget, diag, W) {
  if (path.length === length) return true
  if (budget.left-- <= 0) return false

  const last = path[path.length - 1]
  for (const next of shuffled(
    nbrs[last].filter((n) => free[n]),
    rng,
  )) {
    // Refuse a diagonal through a block another diagonal already uses; that's
    // exactly the configuration that renders as two words crossing.
    const block = diagonalBlock(last, next, W)
    if (block >= 0 && diag[block]) continue

    if (block >= 0) diag[block] = 1
    free[next] = 0
    path.push(next)
    if (extend(path, free, nbrs, length, rng, budget, diag, W)) return true
    path.pop()
    free[next] = 1
    if (block >= 0) diag[block] = 0
    if (budget.left <= 0) return false
  }
  return false
}

/**
 * The spangram has to touch two opposite edges. Rather than generating random
 * paths and hoping, this starts on one edge and drives toward the other, with
 * an admissible cutoff: if the remaining steps can't cover the remaining
 * distance, the branch is abandoned immediately.
 */
function findSpangramPath(free, nbrs, W, H, length, rng, budget, diag) {
  const orientations = []
  if (length >= W) orientations.push('h')
  if (length >= H) orientations.push('v')
  if (!orientations.length) return null

  for (const orientation of shuffled(orientations, rng)) {
    const horizontal = orientation === 'h'
    const span = horizontal ? W : H
    const coord = (i) => (horizontal ? i % W : (i / W) | 0)

    const startCells = [...free.keys()].filter((i) => free[i] && coord(i) === 0)

    for (const start of shuffled(startCells, rng)) {
      const path = [start]
      free[start] = 0
      if (driveToEdge(path, free, nbrs, length, span - 1, coord, rng, budget, diag, W)) {
        return path
      }
      free[start] = 1
      if (budget.left <= 0) return null
    }
  }
  return null
}

function driveToEdge(path, free, nbrs, length, target, coord, rng, budget, diag, W) {
  const last = path[path.length - 1]
  if (path.length === length) return coord(last) === target

  if (budget.left-- <= 0) return false

  // Not enough steps left to reach the far edge — dead branch.
  const stepsLeft = length - path.length
  if (target - coord(last) > stepsLeft) return false

  // Bias toward the far edge, but keep ties random so restarts explore
  // genuinely different boards.
  const options = shuffled(
    nbrs[last].filter((n) => free[n]),
    rng,
  ).sort((a, b) => coord(b) - coord(a))

  for (const next of options) {
    const block = diagonalBlock(last, next, W)
    if (block >= 0 && diag[block]) continue

    if (block >= 0) diag[block] = 1
    free[next] = 0
    path.push(next)
    if (driveToEdge(path, free, nbrs, length, target, coord, rng, budget, diag, W)) {
      return true
    }
    path.pop()
    free[next] = 1
    if (block >= 0) diag[block] = 0
    if (budget.left <= 0) return false
  }
  return false
}

/* ------------------------------------------------------------------ packing */

function tryPack(spangram, words, W, H, rng) {
  const N = W * H
  const free = new Uint8Array(N).fill(1)
  const nbrs = buildNeighbours(W, H)
  const placements = []
  // One flag per 2x2 block, shared across every word, so no two diagonals can
  // cross anywhere on the board.
  const diag = new Uint8Array((W - 1) * (H - 1))

  const spanBudget = { left: NODE_BUDGET }
  const spanPath = findSpangramPath(
    free,
    nbrs,
    W,
    H,
    spangram.length,
    rng,
    spanBudget,
    diag,
  )
  if (!spanPath) return null
  placements.push({ word: spangram, cells: spanPath, spangram: true })

  // Longest first: long words have the fewest legal paths, so if the board
  // can't take them we want to find that out before spending effort on short
  // ones that fit almost anywhere.
  const ordered = [...words].sort((a, b) => b.length - a.length)

  for (let i = 0; i < ordered.length; i++) {
    const word = ordered[i]
    const budget = { left: NODE_BUDGET }
    const path = findPath(free, nbrs, word.length, rng, budget, diag, W)
    if (!path) return null
    placements.push({ word, cells: path, spangram: false })

    const remaining = ordered.slice(i + 1).map((w) => w.length)
    if (remaining.length && !stillFillable(free, nbrs, remaining)) return null
  }

  if (free.some((f) => f)) return null
  return placements
}

function pack(spangram, words, W, H, seed) {
  for (let attempt = 0; attempt < RESTARTS; attempt++) {
    const rng = mulberry32(seed + attempt * 7919)
    const result = tryPack(spangram, words, W, H, rng)
    if (result) return { placements: result, attempts: attempt + 1 }
  }
  return null
}

/* -------------------------------------------------------------- bonus words */

/**
 * Every real 4+ letter word traceable on the finished board that isn't a theme
 * word. Baked in at build time so the app never ships a dictionary for Strands
 * — finding three of these is what earns a hint.
 */
function findBonusWords(letters, W, H, themeWords) {
  const dict = require('an-array-of-english-words')

  const valid = new Set()
  const prefixes = new Set()
  for (const raw of dict) {
    if (raw.length < 4 || raw.length > 8) continue
    if (!/^[a-z]+$/.test(raw)) continue
    const word = raw.toUpperCase()
    valid.add(word)
    for (let i = 1; i <= word.length; i++) prefixes.add(word.slice(0, i))
  }

  const nbrs = buildNeighbours(W, H)
  const theme = new Set(themeWords)
  const found = new Set()
  const used = new Uint8Array(W * H)

  const walk = (cell, prefix) => {
    const next = prefix + letters[cell]
    // Prefix pruning is what makes this tractable: without it the search is
    // 48 cells × 8 branches × 8 deep.
    if (!prefixes.has(next)) return
    if (next.length >= 4 && valid.has(next) && !theme.has(next)) found.add(next)
    if (next.length === 8) return

    used[cell] = 1
    for (const n of nbrs[cell]) {
      if (!used[n]) walk(n, next)
    }
    used[cell] = 0
  }

  for (let i = 0; i < W * H; i++) walk(i, '')
  return [...found].sort()
}

/* --------------------------------------------------------------------- main */

const spangram = STRANDS.spangram.toUpperCase().replace(/[^A-Z]/g, '')
const words = STRANDS.themeWords.map((w) => w.toUpperCase().replace(/[^A-Z]/g, ''))
const total = spangram.length + words.reduce((n, w) => n + w.length, 0)

const dims = []
for (let W = 5; W <= 8; W++) {
  if (total % W !== 0) continue
  const H = total / W
  if (H >= 5 && H <= 10) dims.push([W, H])
}
// NYT's board is 6 wide by 8 tall; prefer that shape, then anything taller
// than it is wide.
dims.sort((a, b) => {
  const score = ([w, h]) => (w === 6 && h === 8 ? -100 : w - h)
  return score(a) - score(b)
})

console.log(`theme    : ${STRANDS.title}`)
console.log(`spangram : ${spangram} (${spangram.length})`)
console.log(`words    : ${words.join(', ')}`)
console.log(`letters  : ${total}`)

if (!dims.length) {
  const suggestions = []
  for (let W = 5; W <= 8; W++) {
    for (let H = 5; H <= 10; H++) {
      const target = W * H
      if (Math.abs(target - total) <= 8) {
        suggestions.push(`${target} (${W}x${H}, ${target > total ? '+' : ''}${target - total})`)
      }
    }
  }
  console.error(
    `\nERROR: ${total} letters can't fill a board.\n` +
      `Strands has no filler letters, so the total must be exactly width x height.\n` +
      `Nearby workable totals: ${[...new Set(suggestions)].join(', ')}\n` +
      `Adjust a word in src/content/puzzles.ts and re-run.`,
  )
  process.exit(1)
}

const seed = Number(process.argv[2] ?? 20260804)
let packed = null
let chosen = null

for (const [W, H] of dims) {
  process.stdout.write(`packing  : trying ${W}x${H}… `)
  packed = pack(spangram, words, W, H, seed)
  if (packed) {
    chosen = [W, H]
    console.log(`solved in ${packed.attempts} restart(s)`)
    break
  }
  console.log('no fit')
}

if (!packed) {
  console.error(
    `\nERROR: couldn't pack these words after ${RESTARTS} restarts per board size.\n` +
      `Try a different seed (node --experimental-strip-types scripts/build-strands.mjs 12345),\n` +
      `or swap one word — very long words plus very short ones are the hardest mix to fit.`,
  )
  process.exit(1)
}

const [W, H] = chosen
const letters = new Array(W * H).fill('')
for (const { word, cells } of packed.placements) {
  cells.forEach((cell, i) => {
    letters[cell] = word[i]
  })
}

process.stdout.write('bonus    : scanning board for real words… ')
const bonus = findBonusWords(letters, W, H, [spangram, ...words])
console.log(`${bonus.length} found`)

const grid = letters.join('')
const body = `// GENERATED by scripts/build-strands.mjs — do not edit by hand.
// Re-run \`npm run build:strands\` after changing STRANDS in puzzles.ts.
//
// Board: ${W}x${H}, seed ${seed}, solved in ${packed.attempts} restart(s).

export interface Placement {
  word: string
  /** Board cell indices, row-major, in spelling order. */
  cells: number[]
  spangram: boolean
}

export const GRID_WIDTH = ${W}
export const GRID_HEIGHT = ${H}

/** Row-major, one character per cell. */
export const GRID_LETTERS = '${grid}'

export const PLACEMENTS: Placement[] = ${JSON.stringify(packed.placements, null, 2)}

/** Real words traceable on this board that aren't theme words. Three earns a hint. */
export const BONUS_WORDS: string[] = ${JSON.stringify(bonus)}
`

writeFileSync(OUT, body)

console.log('')
for (let r = 0; r < H; r++) {
  console.log('   ' + letters.slice(r * W, r * W + W).join(' '))
}
console.log(`\nwrote ${OUT.split('/').slice(-2).join('/')}`)
