import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STRANDS } from '../../content/puzzles'
import {
  BONUS_WORDS,
  GRID_HEIGHT,
  GRID_LETTERS,
  GRID_WIDTH,
  PLACEMENTS,
} from '../../content/strands-grid.gen'
import { setGameStatus } from '../../lib/progress'
import { usePersistentState } from '../../lib/usePersistentState'
import { useToasts } from '../../components/Toast'
import { cellAtPoint, DRAG_RADIUS, TAP_RADIUS } from './hit-test'
import Ribbon, { CELL } from './Ribbon'
import { pickHintWord } from './hint-order'
import './strands.css'

const KEY = 'three-months:v1:strands'
const BONUS_PER_HINT = 3
const MIN_WORD = 4

const W = GRID_WIDTH
const H = GRID_HEIGHT
const BONUS_SET = new Set(BONUS_WORDS)
const THEME_BY_WORD = new Map(PLACEMENTS.map((p) => [p.word, p]))
const TOTAL_WORDS = PLACEMENTS.length

function areAdjacent(a: number, b: number): boolean {
  const dr = Math.abs(Math.floor(a / W) - Math.floor(b / W))
  const dc = Math.abs((a % W) - (b % W))
  return dr <= 1 && dc <= 1 && dr + dc > 0
}

interface SavedState {
  found: string[]
  bonusFound: string[]
  /** Theme words revealed by spending a hint. */
  hinted: string[]
  status: 'in-progress' | 'won'
}

const INITIAL: SavedState = { found: [], bonusFound: [], hinted: [], status: 'in-progress' }

export default function Strands({ onBack }: { onBack: () => void }) {
  const [saved, setSaved] = usePersistentState<SavedState>(KEY, INITIAL)
  const [path, setPath] = useState<number[]>([])
  const [showResult, setShowResult] = useState(false)

  const { toast, layer } = useToasts()
  const gridRef = useRef<HTMLDivElement>(null)
  // Distinguishes a drag from a tap: a tap leaves the path open so she can
  // keep tapping letters, a drag submits on release.
  const dragged = useRef(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const foundSet = useMemo(() => new Set(saved.found), [saved.found])
  const hintsEarned = Math.floor(saved.bonusFound.length / BONUS_PER_HINT)
  const hintsAvailable = hintsEarned - saved.hinted.length
  const finished = saved.status === 'won'

  /** Cells belonging to words she's found, plus any she's spent a hint on. */
  const revealedCells = useMemo(() => {
    const map = new Map<number, 'theme' | 'spangram' | 'hint'>()
    for (const placement of PLACEMENTS) {
      if (foundSet.has(placement.word)) {
        for (const cell of placement.cells) {
          map.set(cell, placement.spangram ? 'spangram' : 'theme')
        }
      } else if (saved.hinted.includes(placement.word)) {
        for (const cell of placement.cells) map.set(cell, 'hint')
      }
    }
    return map
  }, [foundSet, saved.hinted])

  const commit = useCallback(
    (cells: number[]) => {
      if (cells.length < MIN_WORD) {
        // A single cell is just the start of a tap-selection, not a failed
        // guess — saying anything there would nag on every tap.
        if (cells.length > 1) toast(`Words are at least ${MIN_WORD} letters`)
        setPath([])
        return
      }

      const word = cells.map((c) => GRID_LETTERS[c]).join('')
      const backwards = [...word].reverse().join('')

      // Accepting either direction is more generous than NYT. Tracing the
      // right letters in the wrong order is still finding the word, and
      // rejecting it would just feel broken.
      const match = THEME_BY_WORD.has(word)
        ? word
        : THEME_BY_WORD.has(backwards)
          ? backwards
          : null

      if (match && !foundSet.has(match)) {
        const found = [...saved.found, match]
        const won = found.length === TOTAL_WORDS
        setSaved({ ...saved, found, status: won ? 'won' : 'in-progress' })
        setPath([])
        if (THEME_BY_WORD.get(match)!.spangram) toast('That’s the spangram!')
        if (won) {
          setGameStatus('strands', 'won')
          timers.current.push(window.setTimeout(() => setShowResult(true), 800))
        }
        return
      }

      if (match) {
        toast('Already found')
        setPath([])
        return
      }

      if (BONUS_SET.has(word) || BONUS_SET.has(backwards)) {
        const hit = BONUS_SET.has(word) ? word : backwards
        if (saved.bonusFound.includes(hit)) {
          toast('Already found')
        } else {
          const bonusFound = [...saved.bonusFound, hit]
          setSaved({ ...saved, bonusFound })
          const toNext = BONUS_PER_HINT - (bonusFound.length % BONUS_PER_HINT)
          toast(
            bonusFound.length % BONUS_PER_HINT === 0
              ? 'Hint unlocked!'
              : `Nice — ${toNext} more for a hint`,
          )
        }
        setPath([])
        return
      }

      // Neither a theme word nor one of the real words hiding on the board.
      // Silence here reads as the drag having failed to register at all.
      toast(`“${word}” isn’t a word`)
      setPath([])
    },
    [saved, foundSet, setSaved, toast],
  )

  const cellAt = (clientX: number, clientY: number, radius: number): number | null => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return null
    return cellAtPoint(rect, clientX, clientY, radius, W, H)
  }

  const extend = useCallback((cell: number) => {
    setPath((prev) => {
      if (prev.length === 0) return [cell]
      if (prev[prev.length - 1] === cell) return prev
      // Dragging back onto the previous letter rubs it out.
      if (prev.length >= 2 && prev[prev.length - 2] === cell) return prev.slice(0, -1)
      if (prev.includes(cell)) return prev
      if (!areAdjacent(prev[prev.length - 1], cell)) return prev
      return [...prev, cell]
    })
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (finished) return
    const cell = cellAt(e.clientX, e.clientY, TAP_RADIUS)
    if (cell === null) return

    // Capture on the grid so a drag that strays past the edge keeps reporting
    // moves instead of stopping dead.
    gridRef.current?.setPointerCapture(e.pointerId)
    dragged.current = false

    // Re-tapping the last letter of an open path submits it.
    if (path.length > 0 && path[path.length - 1] === cell) {
      commit(path)
      return
    }
    if (path.length > 0 && areAdjacent(path[path.length - 1], cell) && !path.includes(cell)) {
      const next = [...path, cell]
      setPath(next)
      // Auto-accept the moment a tapped path spells a theme word, so she never
      // has to know about the re-tap-to-submit rule.
      const word = next.map((c) => GRID_LETTERS[c]).join('')
      if (THEME_BY_WORD.has(word) && !foundSet.has(word)) commit(next)
      return
    }
    setPath([cell])
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (finished || path.length === 0) return
    if (e.buttons === 0 && e.pointerType === 'mouse') return
    const cell = cellAt(e.clientX, e.clientY, DRAG_RADIUS)
    if (cell === null) return
    if (cell !== path[path.length - 1]) dragged.current = true
    extend(cell)
  }

  const onPointerUp = () => {
    if (finished) return
    // A tap leaves the path open for more tapping; a drag ends the word.
    if (dragged.current) commit(path)
    dragged.current = false
  }

  const nextHintWord = useMemo(
    () => pickHintWord(PLACEMENTS, saved.found, saved.hinted),
    [saved.found, saved.hinted],
  )

  const useHint = () => {
    if (hintsAvailable <= 0 || !nextHintWord) return
    setSaved({ ...saved, hinted: [...saved.hinted, nextHintWord.word] })
    toast('One word lit up — now trace it')
  }

  return (
    <div className="screen strands no-select">
      <div className="topbar">
        <button className="topbar__button" onClick={onBack} aria-label="Back to menu">
          ‹ Menu
        </button>
        <span className="topbar__title">Strands</span>
        <span className="topbar__button" aria-hidden="true" />
      </div>

      {layer}

      <div className="strands__theme">
        <span className="strands__theme-label">Today’s theme</span>
        <h2 className="strands__theme-title">{STRANDS.title}</h2>
      </div>

      <div
        className="strands__grid-wrap"
        style={{ '--cols': W, '--rows': H } as React.CSSProperties}
      >
        <svg
          className="strands__lines"
          viewBox={`0 0 ${W * CELL} ${H * CELL}`}
          aria-hidden="true"
        >
          {PLACEMENTS.filter((p) => foundSet.has(p.word)).map((p) => (
            <Ribbon
              key={p.word}
              cells={p.cells}
              cols={W}
              variant={p.spangram ? 'spangram' : 'theme'}
            />
          ))}

          <Ribbon cells={path} cols={W} variant="active" />
        </svg>

        <div
          ref={gridRef}
          className="strands__grid"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {GRID_LETTERS.split('').map((letter, i) => {
            const revealed = revealedCells.get(i)
            return (
              <div
                key={i}
                className={[
                  'scell',
                  revealed === 'hint' ? 'scell--hint' : '',
                  path.includes(i) ? 'scell--active' : '',
                  revealed && revealed !== 'hint' ? 'scell--found' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {letter}
              </div>
            )
          })}
        </div>
      </div>

      <div className="strands__footer">
        <p className="strands__count">
          <strong>
            {saved.found.length} of {TOTAL_WORDS}
          </strong>{' '}
          theme words found
        </p>

        {!finished ? (
          <button className="btn" onClick={useHint} disabled={hintsAvailable <= 0}>
            {hintsAvailable > 0
              ? `Hint (${hintsAvailable})`
              : `Hint — ${BONUS_PER_HINT - (saved.bonusFound.length % BONUS_PER_HINT)} words to go`}
          </button>
        ) : (
          <button className="btn btn--primary" onClick={onBack}>
            Back to menu
          </button>
        )}
      </div>

      {showResult && (
        <div className="sheet-backdrop" onClick={() => setShowResult(false)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="sheet__title">All of them.</h2>
            <p className="sheet__caption">
              {STRANDS.title} — every last word.
              {saved.hinted.length === 0 && saved.found.length === TOTAL_WORDS
                ? ' Without a single hint.'
                : ''}
            </p>
            <div className="sheet__actions">
              <button className="btn btn--primary" onClick={onBack}>
                Back to menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
