/**
 * Validates src/content/puzzles.ts against what each game actually requires.
 *
 *   npm run check:content
 *
 * Run this after editing puzzles. Every rule here corresponds to a way the
 * games break or look wrong on a phone, and the stale-grid check below is the
 * one most likely to bite: editing the Strands words without re-running
 * `npm run build:strands` leaves the board spelling the old ones.
 */
import { createRequire } from 'node:module'
import { WORDLE, CONNECTIONS, STRANDS } from '../src/content/puzzles.ts'

const require = createRequire(import.meta.url)

const errors = []
const warnings = []
const err = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

/* ------------------------------------------------------------------ Wordle */

const answer = WORDLE.answer.toUpperCase()
if (!/^[A-Z]{5}$/.test(answer)) {
  err(`Wordle: answer "${WORDLE.answer}" must be exactly 5 letters A–Z.`)
}
if (/placeholder/i.test(WORDLE.caption)) {
  warn('Wordle: caption is still placeholder text.')
}

const dict = new Set(
  require('an-array-of-english-words')
    .filter((w) => /^[a-z]{5}$/.test(w))
    .map((w) => w.toUpperCase()),
)
if (/^[A-Z]{5}$/.test(answer) && !dict.has(answer)) {
  console.log(
    `note    : "${answer}" isn't a dictionary word — that's fine, it's accepted\n` +
      `          automatically. But she can only reach it by guessing real words,\n` +
      `          so make sure it's guessable from the letters she'll uncover.`,
  )
}

/* ------------------------------------------------------------- Connections */

if (CONNECTIONS.groups.length !== 4) {
  err(`Connections: needs exactly 4 groups, found ${CONNECTIONS.groups.length}.`)
}

const seen = new Map()
for (const group of CONNECTIONS.groups) {
  if (group.members.length !== 4) {
    err(`Connections: group "${group.name}" has ${group.members.length} members, needs 4.`)
  }
  if (/PLACEHOLDER/i.test(group.name)) {
    warn(`Connections: group "${group.name}" is still placeholder text.`)
  }
  for (const member of group.members) {
    // A member in two groups makes the puzzle genuinely unsolvable — the game
    // maps each tile to exactly one group.
    if (seen.has(member)) {
      err(
        `Connections: "${member}" appears in both "${seen.get(member)}" and ` +
          `"${group.name}". Every tile must belong to exactly one group.`,
      )
    }
    seen.set(member, group.name)

    if (member.length > 11) {
      warn(
        `Connections: "${member}" is ${member.length} characters — it'll be shrunk ` +
          `to fit and may look cramped on a small iPhone. 11 or fewer is safest.`,
      )
    }
  }
}

/* ----------------------------------------------------------------- Strands */

const clean = (w) => w.toUpperCase().replace(/[^A-Z]/g, '')
const spangram = clean(STRANDS.spangram)
const themeWords = STRANDS.themeWords.map(clean)
const total = spangram.length + themeWords.reduce((n, w) => n + w.length, 0)

for (const word of [spangram, ...themeWords]) {
  if (word.length < 4) err(`Strands: "${word}" is under 4 letters.`)
}
if (themeWords.length < 3) {
  warn(`Strands: only ${themeWords.length} theme words — 4 to 8 plays better.`)
}

const dims = []
for (let W = 5; W <= 8; W++) {
  if (total % W === 0 && total / W >= 5 && total / W <= 10) dims.push([W, total / W])
}
if (!dims.length) {
  const near = new Set()
  for (let W = 5; W <= 8; W++) {
    for (let H = 5; H <= 10; H++) {
      const t = W * H
      if (Math.abs(t - total) <= 8) near.add(`${t} (${W}x${H}, ${t > total ? '+' : ''}${t - total})`)
    }
  }
  err(
    `Strands: ${total} letters can't fill a board — Strands has no filler letters,\n` +
      `         so the total must be exactly width x height.\n` +
      `         Nearby workable totals: ${[...near].join(', ')}`,
  )
} else if (spangram.length < Math.min(...dims.map(([W]) => W))) {
  err(
    `Strands: spangram "${spangram}" (${spangram.length}) is too short to reach ` +
      `two opposite edges of a ${dims[0][0]}x${dims[0][1]} board.`,
  )
}

// Stale generated board — the single easiest mistake to make.
try {
  const gen = await import('../src/content/strands-grid.gen.ts')
  const placed = gen.PLACEMENTS.map((p) => p.word).sort()
  const authored = [spangram, ...themeWords].sort()
  if (JSON.stringify(placed) !== JSON.stringify(authored)) {
    err(
      `Strands: the generated board doesn't match the words in puzzles.ts.\n` +
        `         board has  : ${placed.join(', ')}\n` +
        `         puzzles has: ${authored.join(', ')}\n` +
        `         Fix with: npm run build:strands`,
    )
  }
} catch {
  err('Strands: no generated board found. Run: npm run build:strands')
}

/* -------------------------------------------------------------------- done */

for (const w of warnings) console.log(`warning : ${w}`)
for (const e of errors) console.error(`ERROR   : ${e}`)

if (errors.length) {
  console.error(`\n${errors.length} error(s). Fix these before deploying.`)
  process.exit(1)
}
console.log(
  warnings.length
    ? `\nNo errors, ${warnings.length} warning(s). Safe to deploy.`
    : '\nAll content checks passed.',
)
