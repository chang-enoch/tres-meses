import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CONNECTIONS } from '../../content/puzzles'
import { setGameStatus } from '../../lib/progress'
import { usePersistentState } from '../../lib/usePersistentState'
import { useToasts } from '../../components/Toast'
import './connections.css'

const KEY = 'three-months:v1:connections'
const MAX_MISTAKES = 4

const GROUPS = CONNECTIONS.groups
const ALL_MEMBERS = GROUPS.flatMap((g) => g.members)

const GROUP_OF = new Map<string, number>()
GROUPS.forEach((group, i) => {
  for (const member of group.members) GROUP_OF.set(member, i)
})

interface SavedState {
  /** Group indices in the order she solved them. */
  solved: number[]
  mistakes: number
  /** Tile order, persisted so a refresh doesn't reshuffle the board. */
  order: string[]
  /** Every set of four already submitted, as sorted fingerprints. */
  attempts: string[]
  status: 'in-progress' | 'won' | 'lost'
}

/** Order-independent identity for a set of four tiles. */
const fingerprint = (members: string[]) => [...members].sort().join('|')

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Longer strings step down a size so they don't wrap awkwardly on a narrow phone. */
function sizeClass(text: string): string {
  if (text.length > 11) return 'ctile--xs'
  if (text.length > 8) return 'ctile--sm'
  return ''
}

export default function Connections({ onBack }: { onBack: () => void }) {
  const [saved, setSaved] = usePersistentState<SavedState>(KEY, {
    solved: [],
    mistakes: 0,
    order: shuffle(ALL_MEMBERS),
    attempts: [],
    status: 'in-progress',
  })

  const [selected, setSelected] = useState<string[]>([])
  const [wrongShake, setWrongShake] = useState(false)
  const [showResult, setShowResult] = useState(false)
  // Groups revealed by losing, drip-fed so the reveal doesn't dump at once.
  const [revealed, setRevealed] = useState<number[]>([])

  const { toast, layer } = useToasts()
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const finished = saved.status !== 'in-progress'

  // A tile leaves the board once its group is on screen — whether she solved it
  // or it was revealed after a loss. So by the time the last group is revealed
  // the grid is empty, and the answer stands on its own instead of sitting
  // above a board still showing the tiles it just explained.
  const remaining = useMemo(() => {
    const shown = new Set([...saved.solved, ...revealed])
    return saved.order.filter((m) => !shown.has(GROUP_OF.get(m)!))
  }, [saved.order, saved.solved, revealed])

  const toggle = (member: string) => {
    if (finished) return
    setSelected((prev) =>
      prev.includes(member)
        ? prev.filter((m) => m !== member)
        : prev.length < 4
          ? [...prev, member]
          : prev,
    )
  }

  const revealRest = useCallback(
    (alreadySolved: number[]) => {
      const rest = GROUPS.map((_, i) => i).filter((i) => !alreadySolved.includes(i))
      rest.forEach((groupIndex, n) => {
        timers.current.push(
          window.setTimeout(() => setRevealed((prev) => [...prev, groupIndex]), n * 550),
        )
      })
      timers.current.push(
        window.setTimeout(() => setShowResult(true), rest.length * 550 + 500),
      )
    },
    [],
  )

  const submit = () => {
    if (finished || selected.length !== 4) return

    // Re-submitting a set she's already tried is a slip, not a wrong answer, so
    // it costs no mistake. The selection stays put so she can adjust one tile
    // rather than rebuild the whole guess.
    const attempts = saved.attempts ?? []
    const id = fingerprint(selected)
    if (attempts.includes(id)) {
      toast('You already guessed that')
      setWrongShake(true)
      timers.current.push(window.setTimeout(() => setWrongShake(false), 550))
      return
    }
    const nextAttempts = [...attempts, id]

    const groupIndex = GROUP_OF.get(selected[0])!
    const correct = selected.every((m) => GROUP_OF.get(m) === groupIndex)

    if (correct) {
      const solved = [...saved.solved, groupIndex]
      const won = solved.length === GROUPS.length
      setSaved({
        ...saved,
        solved,
        attempts: nextAttempts,
        status: won ? 'won' : 'in-progress',
      })
      setSelected([])
      if (won) {
        setGameStatus('connections', 'won')
        timers.current.push(window.setTimeout(() => setShowResult(true), 700))
      }
      return
    }

    // How close was she? NYT tells you when exactly three shared a group.
    const counts = new Map<number, number>()
    for (const m of selected) {
      const g = GROUP_OF.get(m)!
      counts.set(g, (counts.get(g) ?? 0) + 1)
    }
    const oneAway = [...counts.values()].some((n) => n === 3)

    const mistakes = saved.mistakes + 1
    const lost = mistakes >= MAX_MISTAKES

    setWrongShake(true)
    timers.current.push(window.setTimeout(() => setWrongShake(false), 550))
    if (oneAway && !lost) toast('One away…')

    setSaved({
      ...saved,
      mistakes,
      attempts: nextAttempts,
      status: lost ? 'lost' : 'in-progress',
    })

    if (lost) {
      setSelected([])
      setGameStatus('connections', 'lost')
      timers.current.push(window.setTimeout(() => revealRest(saved.solved), 600))
    }
  }

  // Bands shown at the top: solved by her, then any revealed after a loss.
  const bands = [...saved.solved, ...revealed.filter((i) => !saved.solved.includes(i))]

  return (
    <div className="screen connections no-select">
      <div className="topbar">
        <button className="topbar__button" onClick={onBack} aria-label="Back to menu">
          ‹ Menu
        </button>
        <span className="topbar__title">Connections</span>
        <span className="topbar__button" aria-hidden="true" />
      </div>

      {layer}

      <p className="connections__prompt">Create four groups of four.</p>

      <div className="connections__board">
        {bands.map((groupIndex) => (
          <div key={groupIndex} className={`band band--${groupIndex}`}>
            <span className="band__name">{GROUPS[groupIndex].name}</span>
            <span className="band__members">
              {GROUPS[groupIndex].members.join(', ')}
            </span>
          </div>
        ))}

        {remaining.length > 0 && (
          <div className={`connections__grid ${wrongShake ? 'shake' : ''}`}>
            {remaining.map((member) => (
              <button
                key={member}
                className={[
                  'ctile',
                  sizeClass(member),
                  selected.includes(member) ? 'ctile--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => toggle(member)}
                aria-pressed={selected.includes(member)}
              >
                {member}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="connections__footer">
        <div className="mistakes">
          <span className="mistakes__label">Mistakes remaining</span>
          <div className="mistakes__dots">
            {Array.from({ length: MAX_MISTAKES }, (_, i) => (
              <span
                key={i}
                className={`dot ${i < MAX_MISTAKES - saved.mistakes ? 'dot--on' : ''}`}
              />
            ))}
          </div>
        </div>

        {!finished ? (
          <div className="connections__actions">
            <button
              className="btn"
              onClick={() => setSaved({ ...saved, order: shuffle(saved.order) })}
            >
              Shuffle
            </button>
            <button
              className="btn"
              onClick={() => setSelected([])}
              disabled={selected.length === 0}
            >
              Deselect
            </button>
            <button
              className="btn btn--primary"
              onClick={submit}
              disabled={selected.length !== 4}
            >
              Submit
            </button>
          </div>
        ) : (
          <div className="connections__actions">
            <button className="btn btn--primary" onClick={onBack}>
              Back to menu
            </button>
          </div>
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
            <h2 className="sheet__title">
              {saved.status === 'won'
                ? saved.mistakes === 0
                  ? 'Perfect.'
                  : 'Nicely done'
                : 'Next time'}
            </h2>
            <p className="sheet__caption">
              {saved.status === 'won'
                ? saved.mistakes === 0
                  ? 'Not a single mistake.'
                  : `Solved with ${saved.mistakes} mistake${saved.mistakes === 1 ? '' : 's'}.`
                : 'The groups are up there now — have a look.'}
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
