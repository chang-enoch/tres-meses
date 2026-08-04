# Three Months

Wordle, Connections and Strands, rebuilt with answers about us. Built to be
opened on an iPhone.

## Quick start

```bash
npm install
npm run dev -- --host    # --host exposes a LAN URL you can open on your phone
```

Test on the actual phone, not the desktop browser. Most of the work in here is
iOS-specific — safe areas, drag handling, viewport height — and none of it is
visible in a desktop window.

## Editing the puzzles

Everything she'll read lives in two files:

| File | What's in it |
|---|---|
| `src/content/puzzles.ts` | Wordle answer, Connections groups, Strands words, hub copy |
| `src/content/finale.ts` | The letter she gets at the end |

After editing, always:

```bash
npm run check:content
```

It catches the mistakes that would otherwise surface on her phone: a Wordle
answer that isn't 5 letters, a tile that belongs to two Connections groups,
Strands words that can't fill a board, or a stale Strands grid.

### Strands needs a rebuild

Strands has no filler letters — the spangram and theme words must fill the
board exactly, so the total letter count has to equal width × height. Workable
totals are **36, 40, 42, 45, 48, 49 and 54** (48 is a 6×8 board, same as NYT).

After changing any Strands word:

```bash
npm run build:strands
```

This packs the words into a board and regenerates `strands-grid.gen.ts`. If it
can't find a fit, it says so and suggests what to change. It also scans the
finished board for every real word traceable on it, which is what the hint
system spends.

### Wordle's dictionary

`npm run build:wordlist` regenerates the guess list. You only need this if you
want to change which guesses are accepted — the answer itself is always valid
automatically, and inside jokes go in `extraValidWords`.

## Photos

```bash
mkdir -p assets-raw/photos
# drag photos in, then:
npm run prep:assets
```

Files are processed in alphabetical order, so prefix them `01-`, `02-` if you
want a particular sequence.

`assets-raw/` is gitignored and never gets committed. The script converts HEIC
to JPEG (Chrome can't display HEIC at all, so this isn't optional), resizes for
mobile, and strips EXIF. **It verifies the GPS coordinates are gone** and
refuses to finish if any survive — iPhone photos embed where they were taken,
and this repo is public.

## Deploying

One-time setup:

1. Create an empty repo named `tres-meses` at github.com/new — no README, no
   `.gitignore`.
2. Point this checkout at it and push:
   ```bash
   git remote add origin git@github.com:chang-enoch/tres-meses.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Source → GitHub Actions**.

Every push to `main` redeploys. The site lands at
`https://chang-enoch.github.io/tres-meses/`.

If your username isn't what you named the repo's path, update `base` in
`vite.config.ts` to match — asset URLs break otherwise, and the symptom is a
blank white page.

### Making it private later

Free GitHub Pages only serves public repos: flipping this one to private
unpublishes the site and breaks her link. To have both, either upgrade to
GitHub Pro, or move hosting to Vercel — import the repo at vercel.com/new,
accept the detected Vite settings, and set `base` back to `'/'` in
`vite.config.ts`. The URL changes.

## Commands

| Command | |
|---|---|
| `npm run dev -- --host` | Dev server, reachable from your phone |
| `npm run build` | Typecheck and build |
| `npm test` | Game logic, generated board validity, and render smoke tests |
| `npm run check:content` | Validate puzzles against each game's rules |
| `npm run build:strands` | Repack the Strands board (required after editing its words) |
| `npm run prep:assets` | Process finale photos |

## How it fits together

Plain Vite + React + TypeScript, no UI library and no router — hash routing in
`lib/useHashRoute.ts` keeps GitHub Pages from 404ing on refresh.

Progress lives in `localStorage` via `lib/progress.ts`, which counts a game as
finished whether she won or lost. That's deliberate: the finale is the point,
and locking her out of it because Connections beat her would be a bad ending.

The Strands board is packed at authoring time by `scripts/build-strands.mjs`,
never in the browser. `src/content/strands-grid.test.ts` validates whatever it
last produced — every cell used exactly once, every step adjacent, spangram
touching two opposite edges.
